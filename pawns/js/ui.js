// --- Board Functions ---

// DOM Elements for Board
const getEl = (id) => document.getElementById(id); // Helper
const chessboardEl = getEl('chessboard');
const boardWrapper = document.querySelector('.board-wrapper');

function createBoardDOM() {
    chessboardEl.innerHTML = ''; // Clear previous board
    chessboardEl.classList.remove('flipped');
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const sq = document.createElement('div');
            sq.classList.add('square');
            sq.classList.add((r + c) % 2 === 0 ? 'light' : 'dark');
            sq.dataset.row = r; // Store coordinates
            sq.dataset.col = c;
            chessboardEl.appendChild(sq);
        }
    }
    // Remove interaction listeners previously added here, now added in registerEvents in interaction.js
    // boardWrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
    // boardWrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
    // boardWrapper.addEventListener('touchend', handleTouchEnd, { passive: false });
    // boardWrapper.addEventListener('touchcancel', handleTouchCancel, { passive: false });
    // boardWrapper.addEventListener('click', handleClick);
    console.log("Board DOM created."); // Updated log message
}

function renderBoard() {
    clearVisualState();
    // Optimized piece removal/update
    const currentPieces = {};
    chessboardEl.querySelectorAll('.piece:not(.piece-touch-clone)').forEach(p => {
        const r = p.dataset.row; const c = p.dataset.col;
        if (r && c) {
            if (!touchState.isDragging || p !== touchState.pieceElement) {
                currentPieces[`${r}-${c}`] = p;
            }
        } else { p.remove(); } // Remove if no data attributes (shouldn't happen)
    });
    
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const pieceColorInState = boardState[r][c];
            const key = `${r}-${c}`;
            const existingPiece = currentPieces[key];
            const square = getSquareElement(r, c);

            if (pieceColorInState) {
                const expectedClass = pieceColorInState === 'w' ? 'white' : 'black';
                if (existingPiece) {
                    // Piece exists, check if it's the correct color
                    if (!existingPiece.classList.contains(expectedClass)) {
                        existingPiece.remove(); // Remove wrong piece
                        delete currentPieces[key];
                        const pieceElement = createPieceElement(r, c, pieceColorInState);
                        square?.appendChild(pieceElement); // Add correct piece
                        if (touchState.isDragging && touchState.startSquare?.row === r && touchState.startSquare?.col === c) {
                             pieceElement.classList.add('touch-hidden-original');
                         }
                    } else {
                         // Piece exists and is correct type, ensure visibility unless it's the dragged original
                         if (!touchState.isDragging || touchState.startSquare?.row !== r || touchState.startSquare?.col !== c) {
                             existingPiece.classList.remove('touch-hidden-original');
                         } else {
                             existingPiece.classList.add('touch-hidden-original');
                         }
                        delete currentPieces[key]; // Mark as processed
                    }
                } else {
                    // No piece exists, create it
                    const pieceElement = createPieceElement(r, c, pieceColorInState);
                    square?.appendChild(pieceElement);
                     if (touchState.isDragging && touchState.startSquare?.row === r && touchState.startSquare?.col === c) {
                         pieceElement.classList.add('touch-hidden-original');
                     }
                }
            }
        }
    }

     // Remove any remaining pieces in currentPieces (means they are no longer in boardState)
     Object.values(currentPieces).forEach(p => p.remove());

    applyHighlights();
}

function createPieceElement(row, col, color) {
    const pieceElement = document.createElement('span');
    pieceElement.classList.add('piece', color === 'w' ? 'white' : 'black');
    pieceElement.textContent = color === 'w' ? WHITE_PAWN_CHAR : BLACK_PAWN_CHAR;
    pieceElement.dataset.row = row; pieceElement.dataset.col = col;
    return pieceElement;
}

function getSquareElement(row, col) {
    if (!isValidSquare(row, col)) return null;
    // Optimized selector slightly
    return chessboardEl.children[row * BOARD_SIZE + col];
}

function isValidSquare(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}


// --- UI Functions ---

// UI Elements
const bodyEl = document.body;
const opponentSelector = getEl('opponent-selector');
const aiAvatar = getEl('ai-avatar');
const prevOpponentButton = getEl('prev-opponent');
const nextOpponentButton = getEl('next-opponent');
const restartButton = getEl('restart-button');
const undoButton = getEl('undo-button');
const hintButton = getEl('hint-button');
const undoCountEl = getEl('undo-count');
const hintCountEl = getEl('hint-count');
const enPassantToggleButton = getEl('en-passant-toggle');
const flipBoardButton = getEl('flip-board-button');
const winModal = getEl('win-modal');
const winMessage = getEl('win-message');
const closeButton = winModal.querySelector('.close-button');
const playAgainButton = getEl('play-again-button');
const okButton = getEl('ok-button');
const catPhoto = getEl('cat-photo');
const moveSound = getEl('move-sound');
const captureSound = getEl('capture-sound');
const winSound = getEl('win-sound');

// --- Highlight Management ---
function clearVisualState() {
    // Efficiently query all squares that might have highlights
    const highlightedSquares = chessboardEl.querySelectorAll('.valid-move, .move-capture, .touch-drag-target-valid, .selected-piece-origin, .last-move-from, .last-move-to, .hint-highlight');
    highlightedSquares.forEach(el => el.classList.remove(
        'valid-move', 'move-capture', 'touch-drag-target-valid',
        'selected-piece-origin', 'last-move-from', 'last-move-to', 'hint-highlight'
    ));
    // Ensure original dragged piece becomes visible if drag ends without move
    const hiddenOriginal = chessboardEl.querySelector('.piece.touch-hidden-original');
    hiddenOriginal?.classList.remove('touch-hidden-original');
}

function applyHighlights() {
    highlightLastMove();
    if (touchState.isDragging) {
        highlightValidMoves(touchState.validMoves);
        highlightDropTarget(); // Highlight based on current hover square
    } else if (selectedSquare) {
        highlightSelectedPiece();
        highlightValidMoves(clickValidMoves);
    }
}

function highlightValidMoves(moves) {
    moves.forEach(move => {
        const sq = getSquareElement(move.row, move.col);
        if (sq) {
            sq.classList.add('valid-move');
            if (move.isCapture) sq.classList.add('move-capture');
        }
    });
}

function highlightLastMove() {
    if (lastMove) {
        getSquareElement(lastMove.from.row, lastMove.from.col)?.classList.add('last-move-from');
        getSquareElement(lastMove.to.row, lastMove.to.col)?.classList.add('last-move-to');
    }
}

function highlightDropTarget() {
    if (touchState.isDragging && touchState.currentSquareEl) {
        const row = parseInt(touchState.currentSquareEl.dataset.row);
        const col = parseInt(touchState.currentSquareEl.dataset.col);
        const isValidTarget = touchState.validMoves.some(m => m.row === row && m.col === col);
        if (isValidTarget) {
            // Clear potential old target highlights before adding new one
            chessboardEl.querySelectorAll('.touch-drag-target-valid')
                .forEach(el => el.classList.remove('touch-drag-target-valid'));
            touchState.currentSquareEl.classList.add('touch-drag-target-valid');
        }
    }
}

function highlightSelectedPiece() {
    if (selectedSquare) {
        getSquareElement(selectedSquare.row, selectedSquare.col)?.classList.add('selected-piece-origin');
    }
}

// --- Button Management ---
function updateButtonStates() {
    const undoAllowed = canUndo();
    const hintAllowed = canRequestHint();

    undoButton.disabled = !undoAllowed;
    hintButton.disabled = !hintAllowed;

    // Format counts (show only if finite and > 0)
    const formatCount = (count) => ''; 
    const undoText = ''; 
    const hintText = ''; 

    undoCountEl.textContent = undoText;
    hintCountEl.textContent = hintText;
    undoCountEl.style.display = undoText ? 'inline' : 'none';
    hintCountEl.style.display = hintText ? 'inline' : 'none';

    // Disable opponent switching during AI turn
    const opponentSwitchDisabled = aiThinking;
    prevOpponentButton.disabled = opponentSwitchDisabled || opponents.length <= 1;
    nextOpponentButton.disabled = opponentSwitchDisabled || opponents.length <= 1;

    // Disable interaction-sensitive buttons during AI turn or game over
    const interactionDisabled = aiThinking || gameOver;
    enPassantToggleButton.disabled = interactionDisabled;
    flipBoardButton.disabled = interactionDisabled;
    restartButton.disabled = aiThinking; // Allow restart if game over
}

function updateEnPassantButton() {
    enPassantToggleButton.classList.toggle('active', isEnPassantEnabled);
    enPassantToggleButton.title = isEnPassantEnabled ? "Взяття на проході: Увімкнено" : "Взяття на проході: Вимкнено";
}

// --- Game State Functions ---
function switchPlayer() {
    if (gameOver) return;
    currentPlayer = (currentPlayer === 'w') ? 'b' : 'w';
    console.log("Player switched to:", currentPlayer);
    updateButtonStates();

    if (gameMode === 'pvai' && currentPlayer === aiColor && !gameOver) {
        console.log("AI's turn now, triggering AI move.");
        triggerAiMoveWithDelay();
    } else {
        aiThinking = false; // Ensure AI thinking flag is off if it's player's turn
    }
}

function canUndo() {
    const interactionActive = touchState.isDragging || selectedSquare !== null;
    if (gameOver || interactionActive || aiThinking) return false;

    // Undo allowed if player has undos left
    const hasUndosLeft = undosRemaining === Infinity || undosRemaining > 0;
    if (!hasUndosLeft) return false;

    if (gameMode === 'pvai') {
        // In PvAI mode, can only undo during player's turn and need at least 2 history entries
        return currentPlayer === playerColor && moveHistory.length >= 2;
    } else if (gameMode === 'pvp') {
        // In PvP mode, can undo anytime as long as there's history
        return moveHistory.length >= 1;
    }
    
    return false;
}

function canRequestHint() {
    const interactionActive = touchState.isDragging || selectedSquare !== null;
    // Hint only during player's turn, hints available, not game over/AI thinking
    if (gameOver || interactionActive || aiThinking || currentPlayer !== playerColor) return false;
    
    const hasHintsLeft = hintsRemaining === Infinity || hintsRemaining > 0;
    return hasHintsLeft;
}

// --- Sound Functions ---
function playSound(soundElement) {
    if (soundElement?.play) {
        soundElement.currentTime = 0;
        soundElement.play().catch(error => console.warn("Audio play failed:", error.name, error.message));
    }
}

function updateOpponentInfo(aiLevel) {
    if (opponentNameElement && opponentAvatarElement) {
        opponentNameElement.textContent = aiLevel.name;
        // Устанавливаем src и alt для img аватара
        opponentAvatarElement.src = aiLevel.avatar; // Будет брать URL из constants.js
        opponentAvatarElement.alt = aiLevel.name + " Avatar";
        // Обработчик ошибок, если URL не загрузится
        opponentAvatarElement.onerror = () => {
            console.warn(`Не удалось загрузить аватар по URL: ${aiLevel.avatar}. Используется fallback.`);
            // Используем fallback SVG эмодзи, который вы установили
            opponentAvatarElement.src = fallbackCatImage; 
        };
    }
}

function isValidMove(board, startRow, startCol, endRow, endCol) {
    // Логика функции isValidMove...
}

// --- Modal Logic ---

// Win Modal Functions
function showWinModal(message, showCatPhoto = false) {
    winMessage.textContent = message;
    // Показываем ОБЯЗАТЕЛЬНО обе кнопки чтобы можно было закрыть или продолжить
    okButton.style.display = 'inline-block';
    playAgainButton.style.display = 'inline-block';

    if (showCatPhoto) {
        // Сначала скрываем модальное окно до загрузки гифки
        winModal.style.display = 'none';
        // Начинаем загрузку гифки, модальное окно будет показано после загрузки
        fetchCatPhoto(true);
    } else {
        // Если не нужна гифка, показываем модальное окно сразу
        catPhoto.style.display = 'none';
        winModal.style.display = 'block';
    }
}

function hideWinModal() {
    winModal.style.display = 'none';
    if (catObjectURL) {
        URL.revokeObjectURL(catObjectURL);
        catObjectURL = null;
    }
    gameOver = false; // Reset game over state
    updateButtonStates();
}

// Используем API для поиска смешных ГИФОК с КОТАМИ
function fetchCatPhoto(showModalAfterLoad = false) {
    // API-источник для гифок с котами
    const catApi = 'https://api.thecatapi.com/v1/images/search?mime_types=gif&limit=1&api_key=live_vzrW8a77nNxrHq8dc3fUjpU6e0s2v4T6gM9fP0d7bC3xY1kI5u8tX9qW2aL4oH6j';

    // Скрываем фото пока не загрузится гифка
    catPhoto.style.display = 'none';
    catPhoto.style.maxHeight = '400px';
    catPhoto.style.width = 'auto';
    catPhoto.style.objectFit = 'contain';
    
    // Запрос к API для получения гифки кота
    fetch(catApi)
        .then(response => {
            if (!response.ok) throw new Error('TheCatAPI failed');
            return response.json();
        })
        .then(data => {
            if (data && data[0] && data[0].url) {
                // Начинаем загрузку изображения, но еще не показываем его
                catPhoto.src = data[0].url;
                console.log("Начата загрузка GIF-кота из API:", data[0].url);
                // onload обработчик в конце функции отобразит изображение и модальное окно
            } else {
                throw new Error('TheCatAPI data format error');
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки гифки кота из API:', error);
            // Не показываем эмодзи-заглушку, просто отображаем модальное окно без картинки
            catPhoto.style.display = 'none';
            if (showModalAfterLoad) {
                winModal.style.display = 'block';
            }
        });

    // Таймер на случай, если API не отвечает долго или изображение загружается слишком долго
    let timeoutId = setTimeout(() => {
        console.warn('Загрузка гифки кота заняла слишком много времени');
        catPhoto.style.display = 'none';
        if (showModalAfterLoad) {
            winModal.style.display = 'block';
        }
    }, CAT_API_TIMEOUT_MS);

    // Обработчик на случай, если src установился, но картинка битая
    catPhoto.onerror = function() {
        console.error('Ошибка загрузки гифки кота (onerror):', catPhoto.src);
        clearTimeout(timeoutId);
        catPhoto.style.display = 'none';
        if (showModalAfterLoad) {
            winModal.style.display = 'block';
        }
    };

    // Когда изображение успешно загрузилось
    catPhoto.onload = function() {
        clearTimeout(timeoutId);
        console.log("GIF-кот успешно загружен и готов к отображению!");
        // Показываем изображение
        catPhoto.style.display = 'block';
        // Показываем модальное окно, если нужно
        if (showModalAfterLoad) {
            winModal.style.display = 'block';
        }
    };
}
