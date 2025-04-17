const boardElement = document.getElementById('checkerboard');
const turnElement = document.getElementById('turn');
const boardState = []; // 8x8 array representing the board
const ROWS = 8;
const COLS = 8;

let currentPlayer = 'white'; // 'white' or 'black'
let selectedPiece = null; // { row, col, element, isKing }
let mustCapture = false; // Flag indicating if a capture is mandatory
let availableCaptures = []; // Array of possible capture sequences
let previousPlayerBoardState = null;
let previousPlayerCurrentPlayer = null;
let previousComputerBoardState = null;
let previousComputerCurrentPlayer = null;
let turnInProgress = false; // Flag to manage state saving only once per turn

// --- Drag and Drop State ---
let draggedPieceData = null; // { element, startRow, startCol, isKing, color }
let draggedPieceElement = null; // The visual clone being dragged
let isDragging = false; // Flag to track drag state
let touchIdentifier = null;
let initialTouchX = 0;
let initialTouchY = 0;
let initialPieceOffsetX = 0;
let initialPieceOffsetY = 0;
let isMouseDragging = false; // Flag to track mouse drag state
let ignoreNextClick = false; // Flag to prevent click after drag release
let lastMouseMoveTimeStamp = 0;
let initialMouseX = 0;
let initialMouseY = 0;

// --- Game Mode ---
let aiPlayerColor = 'black'; // AI plays as black by default
let aiThinking = false; // Track when AI is calculating its move

// Add modal elements
const gameResultModal = document.getElementById('game-result-modal');
const gameResultText = document.getElementById('game-result-text');
const modalNewGameBtn = document.getElementById('modal-new-game-btn');

// Function to show game result
function showGameResult(winner) {
    const isPlayerWinner = (winner === 'white' && aiPlayerColor === 'black') || 
                          (winner === 'black' && aiPlayerColor === 'white');
    
    gameResultText.textContent = isPlayerWinner ? 'Ти виграв! 🎉' : 'Ти програв :(';
    gameResultModal.classList.add('active');
    
    // Disable board interaction
    boardElement.style.pointerEvents = 'none';
}

// Function to hide game result
function hideGameResult() {
    gameResultModal.classList.remove('active');
}

// Add event listener for modal new game button
modalNewGameBtn.addEventListener('click', () => {
    hideGameResult();
    resetGame();
});

// *** SIMPLIFIED AI LOGIC - ALL IN ONE FILE ***
function makeAIMove() {
    console.log("AI TURN STARTS");
    aiThinking = true;
    boardElement.style.pointerEvents = 'none'; // Prevent player interaction
    document.getElementById('undo-btn').disabled = true;
    
    // Small delay for visual feedback
    setTimeout(() => {
        try {
            // Find all valid moves for AI
            const allMoves = findAllPossibleMovesForAI();
            console.log("AI found moves:", allMoves);
            
            if (allMoves.length === 0) {
                console.log("AI has no moves!");
                aiThinking = false;
                boardElement.style.pointerEvents = 'auto';
                document.getElementById('undo-btn').disabled = false;
                // Game over will be handled by checkWinCondition
                return;
            }
            
            // Select a move (prioritize captures)
            const captureMoves = allMoves.filter(m => m.isCapture);
            const moveToMake = captureMoves.length > 0 
                ? captureMoves[Math.floor(Math.random() * captureMoves.length)]
                : allMoves[Math.floor(Math.random() * allMoves.length)];
            
            console.log("AI chose move:", moveToMake);
            
            // Execute the move
            executeAIMoveSimple(moveToMake);
        } catch (error) {
            console.error("Error during AI move:", error);
            // Ensure we reset interaction even if there's an error
            aiThinking = false;
            boardElement.style.pointerEvents = 'auto';
            document.getElementById('undo-btn').disabled = false;
        }
    }, 500);
}

// Simple execute function that uses the existing movePiece function
function executeAIMoveSimple(moveInfo) {
    console.log("Executing AI move:", moveInfo);
    
    // Get piece at starting position
    const piece = boardState[moveInfo.startRow][moveInfo.startCol];
    if (!piece) {
        console.error("No piece at AI start position!");
        aiThinking = false;
        boardElement.style.pointerEvents = 'auto';
        document.getElementById('undo-btn').disabled = false;
        return;
    }
    
    // Set selectedPiece to fake a user selection
    selectedPiece = {
        row: moveInfo.startRow,
        col: moveInfo.startCol,
        element: piece.element,
        isKing: piece.isKing
    };
    
    // Call movePiece directly
    movePiece(moveInfo.startRow, moveInfo.startCol, moveInfo.toRow, moveInfo.toCol, moveInfo);
    
    // If AI turn is over, reset interaction
    if (currentPlayer !== aiPlayerColor) {
        console.log("AI TURN COMPLETE");
        aiThinking = false;
        boardElement.style.pointerEvents = 'auto';
        document.getElementById('undo-btn').disabled = false;
    } else {
        // If we're still in AI's turn, it means more captures are required
        console.log("AI continues with more captures");
        
        // Find next capture step
        const nextCaptures = findImmediateCaptures(moveInfo.toRow, moveInfo.toCol, 
                               boardState[moveInfo.toRow][moveInfo.toCol].isKing, aiPlayerColor);
        
        if (nextCaptures.length > 0) {
            const nextStep = {
                startRow: moveInfo.toRow,
                startCol: moveInfo.toCol,
                ...nextCaptures[0] // Contains toRow, toCol, isCapture, capturedPiece
            };
            
            // Continue with next capture after a small delay
            setTimeout(() => executeAIMoveSimple(nextStep), 300);
        } else {
            console.error("Something went wrong: AI turn continues but no captures found");
            // Force end of AI turn
            aiThinking = false;
            boardElement.style.pointerEvents = 'auto';
            document.getElementById('undo-btn').disabled = false;
            deselectPiece();
            if (currentPlayer === aiPlayerColor) switchPlayer();
        }
    }
}

// Find all possible moves for AI (simple version)
function findAllPossibleMovesForAI() {
    const moves = [];
    const captures = findAllPossibleCaptures(aiPlayerColor);
    
    // If there are captures, only those are valid moves
    if (captures.length > 0) {
        for (const capInfo of captures) {
            // For each possible sequence from this piece
            for (const sequence of capInfo.sequences) {
                // We only need the first step of the sequence for the AI
                if (sequence.length > 0) {
                    moves.push({
                        startRow: capInfo.startRow,
                        startCol: capInfo.startCol,
                        toRow: sequence[0].toRow,
                        toCol: sequence[0].toCol,
                        isCapture: true,
                        capturedPiece: sequence[0].capturedPiece
                    });
                }
            }
        }
    } else {
        // Find normal moves if no captures available
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const piece = boardState[r][c];
                if (piece && piece.color === aiPlayerColor) {
                    // Get valid non-capture moves for this piece
                    const normalMoves = calculateValidMoves(r, c, piece.isKing, false);
                    
                    for (const move of normalMoves) {
                        if (!move.isCapture) {
                            moves.push({
                                startRow: r,
                                startCol: c,
                                toRow: move.toRow,
                                toCol: move.toCol,
                                isCapture: false,
                                capturedPiece: null
                            });
                        }
                    }
                }
            }
        }
    }
    
    return moves;
}

function createBoard() {
    boardElement.innerHTML = ''; // Clear previous board if any
    for (let r = 0; r < ROWS; r++) {
        boardState[r] = [];
        for (let c = 0; c < COLS; c++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.dataset.row = r;
            square.dataset.col = c;

            const isDark = (r + c) % 2 === 1;
            square.classList.add(isDark ? 'dark' : 'light');

            if (isDark) {
                if (r < 3) {
                    addPiece(square, 'black', r, c);
                } else if (r > 4) {
                    addPiece(square, 'white', r, c);
                } else {
                    boardState[r][c] = null; // Empty dark square
                }
                // Add event listeners only to dark squares
                square.addEventListener('click', handleSquareClick);
            } else {
                boardState[r][c] = null; // Light squares are always empty conceptually
            }

            boardElement.appendChild(square);
        }
    }
}

function addPiece(squareElement, color, row, col) {
    const piece = document.createElement('div');
    piece.classList.add('piece', `${color}-piece`);
    piece.dataset.color = color;
    squareElement.appendChild(piece);
    boardState[row][col] = { color: color, isKing: false, element: piece };
    piece.addEventListener('click', handlePieceClick);
    piece.addEventListener('touchstart', handleTouchStart, { passive: false });
    piece.addEventListener('mousedown', handleMouseDown, { passive: false });
}

function handlePieceClick(event) {
    // Prevent click handling right after a drag release
    if (ignoreNextClick) {
        ignoreNextClick = false; // Reset flag
        console.log("Ignoring click after drag/touch end.");
        return;
    }
    
    console.log("handlePieceClick triggered"); // Debug log

    if (aiThinking) {
        console.log("AI is thinking, ignoring piece click.");
        return; // Ignore clicks while AI is thinking
    }

    // Stop event propagation to prevent handleSquareClick from also being triggered
    event.stopPropagation();

    const pieceElement = event.target.closest('.piece');
    if (!pieceElement) return; // Click was not on a piece element

    const squareElement = pieceElement.parentElement;
    if (!squareElement || !squareElement.dataset.row || !squareElement.dataset.col) {
        console.error("Could not find parent square or its data attributes for piece:", pieceElement);
        return;
    }

    const row = parseInt(squareElement.dataset.row);
    const col = parseInt(squareElement.dataset.col);
    const pieceData = boardState[row][col];

    console.log(`Clicked on piece at ${row},${col}, color: ${pieceData?.color}, current player: ${currentPlayer}`);

    // Если нажали не на своей шашке - отменяем выбор текущей шашки и игнорируем дальнейшие действия
    if (!pieceData || pieceData.color !== currentPlayer) {
        console.log(`Clicked on opponent piece at ${row},${col} - deselecting current piece`);
        // Deselect any currently selected piece
        if (selectedPiece) {
            deselectPiece();
        }
        return;
    }

    // --- Player clicked their own piece ---
    console.log(`Clicked own piece at ${row},${col}. Selected piece:`, selectedPiece);

    // Check for mandatory captures
    if (mustCapture) {
        const pieceCanCapture = availableCaptures.some(capInfo => capInfo.startRow === row && capInfo.startCol === col);
        if (!pieceCanCapture) {
            console.log("Must capture, but clicked piece cannot capture.");
            // Highlight pieces that can capture for visual feedback
            highlightMandatoryPieces();
            return;
        }
        // If the clicked piece *can* capture, proceed to selection logic below.
    }

    // Проверим, может ли шашка сделать ход
    const possibleMoves = calculateValidMoves(row, col, pieceData.isKing);
    if (possibleMoves.length === 0) {
        console.log(`Piece at ${row},${col} has no valid moves`);
        // If there's a currently selected piece, deselect it
        if (selectedPiece) {
            console.log("Deselecting current piece because clicked piece has no valid moves");
            deselectPiece();
        }
        return;
    }

    if (selectedPiece) {
        // If the *same* piece is clicked again
        if (selectedPiece.row === row && selectedPiece.col === col) {
            console.log("Deselecting piece.");
            deselectPiece();
        } else {
            // If a *different* piece of the current player is clicked
            console.log("Switching selected piece.");
            deselectPiece(); // Deselect the old one
            selectPiece(pieceElement, row, col, pieceData.isKing); // Select the new one
        }
    } else {
        // No piece was selected, so select this one
        console.log("Selecting piece.");
        selectPiece(pieceElement, row, col, pieceData.isKing);
    }
}

function handleSquareClick(event) {
    // Prevent click handling right after a drag release
    if (ignoreNextClick) {
        ignoreNextClick = false; // Reset flag
        console.log("Ignoring square click after drag/touch end.");
        return;
    }
    
    console.log("handleSquareClick triggered"); // Debug log

    // If a piece inside a square was clicked, don't proceed (handlePieceClick handles it)
    if (event.target.closest('.piece')) {
        console.log("Square click contains piece - delegating to piece handler");
        return;
    }

    const squareElement = event.target.closest('.square');
    if (!squareElement || !squareElement.dataset.row || !squareElement.dataset.col) {
        // Click might be outside the board or on something else
        console.log("Clicked outside a valid square or square has no data.");
        return;
    }

    const targetRow = parseInt(squareElement.dataset.row);
    const targetCol = parseInt(squareElement.dataset.col);
    
    // If no piece is selected or AI is thinking, just ignore the click
    if (!selectedPiece || aiThinking) {
        console.log(`Square click ignored. Selected piece: ${!!selectedPiece}, AI thinking: ${aiThinking}`);
        return;
    }

    console.log(`Attempting move from ${selectedPiece.row},${selectedPiece.col} to ${targetRow},${targetCol}`);

    // Get valid moves for the selected piece
    // Pass true to ignoreGlobalMandatory because we've already filtered selectable pieces if mustCapture is true
    const validMoves = calculateValidMoves(selectedPiece.row, selectedPiece.col, selectedPiece.isKing, true);

    // Find if the clicked square is a valid destination
    const move = validMoves.find(m => m.toRow === targetRow && m.toCol === targetCol);

    if (move) {
        console.log("Found valid move:", move);
        // If captures are mandatory globally, ensure this specific move is a capture
        if (mustCapture && !move.isCapture) {
            console.log("Invalid move: Must make a capture.");
            // Provide feedback - re-highlight valid capture moves
            const capturesForSelected = findImmediateCaptures(selectedPiece.row, selectedPiece.col, selectedPiece.isKing, currentPlayer);
            if (capturesForSelected.length > 0) {
                clearHighlights(); // Clear any previous non-capture highlights
                highlightValidMoves(selectedPiece.row, selectedPiece.col, selectedPiece.isKing); // Re-highlight, which should now only show captures
            }
            return; // Ignore the non-capture move click
        }

        console.log(`Executing move from ${selectedPiece.row},${selectedPiece.col} to ${targetRow},${targetCol}`);
        // Pass the detailed move info (which includes capture details)
        movePiece(selectedPiece.row, selectedPiece.col, targetRow, targetCol, move);
    } else {
        // If the clicked square is not a valid move, deselect the piece
        console.log("Invalid move, deselecting piece");
        deselectPiece();
    }
}

function selectPiece(pieceElement, row, col, isKing) {
    // Check if this is the same piece already selected
    if (selectedPiece && selectedPiece.row === row && selectedPiece.col === col) {
        console.log(`Piece at (${row}, ${col}) already selected, not reselecting`);
        return; // Skip redundant selection
    }
    
    deselectPiece(); // Deselect any previously selected piece
    selectedPiece = { row, col, element: pieceElement, isKing };
    pieceElement.classList.add('selected');
    console.log(`Selected piece at (${row}, ${col})`);
    highlightValidMoves(row, col, isKing);
}

function deselectPiece() {
    console.log("Deselecting current piece");
    
    if (selectedPiece) {
        selectedPiece.element.classList.remove('selected');
        console.log(`Removed 'selected' class from piece at (${selectedPiece.row}, ${selectedPiece.col})`);
    }
    
    selectedPiece = null;
    // Remove previous highlights and move info
    clearHighlights();
}

function getSquareElement(row, col) {
    return boardElement.querySelector(`.square[data-row='${row}'][data-col='${col}']`);
}

// --- Game Logic Functions (to be implemented) ---

function highlightValidMoves(row, col, isKing) {
    // First check if this piece is already highlighted to avoid duplicates
    const existingHighlights = document.querySelectorAll('.valid-move, .valid-capture').length;
    const pieceIsAlreadyHighlighted = selectedPiece && 
                                     selectedPiece.row === row && 
                                     selectedPiece.col === col &&
                                     existingHighlights > 0;
    
    if (pieceIsAlreadyHighlighted) {
        console.log(`Piece at (${row}, ${col}) already has highlighted moves, skipping duplicate call`);
        return true; // Return true to indicate valid moves exist
    }
    
    // Only log once to avoid duplicate logs
    console.log("Highlighting next moves for", row, col, isKing);
    clearHighlights();

    // Get only the immediate next moves possible from this square
    // The calculateValidMoves function now incorporates the mandatory capture check
    const moves = calculateValidMoves(row, col, isKing);
    console.log("Possible next steps:", moves);

    moves.forEach(move => {
        const targetSquare = getSquareElement(move.toRow, move.toCol);
        if (targetSquare) {
            targetSquare.classList.add(move.isCapture ? 'valid-capture' : 'valid-move');
            // Store the single step move info
            targetSquare.dataset.moveInfo = JSON.stringify(move);
        }
    });
    
    // Add a debugging check to see if moves are being highlighted properly
    const highlightedSquares = document.querySelectorAll('.valid-move, .valid-capture');
    console.log(`Highlighted ${highlightedSquares.length} squares for piece at (${row}, ${col})`);
    
    return moves.length > 0; // Return whether there are valid moves
}

function movePiece(startRow, startCol, endRow, endCol, moveInfo) {
    console.log(`Executing step:`, moveInfo);

    // Save state *before* the very first action of a turn
    if (!turnInProgress) {
        saveState();
        turnInProgress = true;
        
        // If this is the start of a capture sequence, clear mandatory piece highlighting
        // since the player has committed to a specific capture path
        if (moveInfo.isCapture) {
            clearMandatoryHighlights();
        }
    }

    const pieceData = boardState[startRow][startCol];
    const pieceElement = pieceData.element;
    let becameKing = false;

    // Ensure the piece is visible (restore opacity after drag)
    pieceElement.style.opacity = '1';
    pieceElement.classList.remove('piece-hidden');

    // 1. Clear start square
    boardState[startRow][startCol] = null;

    // 2. Handle Capture (if it's a capture step)
    if (moveInfo.isCapture && moveInfo.capturedPiece) {
        const capturedR = moveInfo.capturedPiece.r;
        const capturedC = moveInfo.capturedPiece.c;
        console.log(`Removing captured piece at (${capturedR}, ${capturedC})`);
        boardState[capturedR][capturedC] = null; // Update state
        const capturedSquare = getSquareElement(capturedR, capturedC);
        if (capturedSquare) {
            capturedSquare.innerHTML = ''; // Remove piece from DOM
        }
    }

    // 3. Place piece in end square
    boardState[endRow][endCol] = pieceData; // Place original piece data first
    const endSquare = getSquareElement(endRow, endCol);
    endSquare.appendChild(pieceElement);

    // 4. Handle Promotion
    const shouldPromote = !pieceData.isKing && ((pieceData.color === 'white' && endRow === 0) || (pieceData.color === 'black' && endRow === ROWS - 1));
    if (shouldPromote) {
        console.log(`Promoting piece at (${endRow}, ${endCol})`);
        promoteToKing(endRow, endCol); // Updates state and adds class
        becameKing = true;
        pieceData.isKing = true;
    }

    // 5. Check for further captures *from the new position* if this was a capture move
    let furtherCapturesPossible = false;
    if (moveInfo.isCapture) {
        const nextCaptures = findImmediateCaptures(endRow, endCol, pieceData.isKing, pieceData.color);
        if (nextCaptures.length > 0) {
            furtherCapturesPossible = true;
            console.log(`Further captures possible from (${endRow}, ${endCol}). Continuing turn.`);
            // Piece remains selected, highlight next jumps
            deselectPiece(); // Clear previous selection state/highlight
            selectPiece(pieceElement, endRow, endCol, pieceData.isKing); // Re-select the piece at new location
            highlightValidMoves(endRow, endCol, pieceData.isKing); // Highlight only next capture(s)
        } else {
            console.log(`No further captures from (${endRow}, ${endCol}).`);
        }
    }

    // 6. If no further captures are possible *after a capture* OR if it was a normal move,
    //    then end the turn.
    if (!furtherCapturesPossible) {
        deselectPiece();
        switchPlayer(); // Switches player and updates mandatory captures for the new player
        turnInProgress = false; // Reset flag for next turn's state saving
        checkWinCondition();
    }

    // Add animation
    animateMove(pieceElement, endRow, endCol);
}

function promoteToKing(row, col) {
    if (boardState[row][col]) {
        boardState[row][col].isKing = true;
        boardState[row][col].element.classList.add('king');
        console.log(`Piece at (${row}, ${col}) promoted to King.`);
    }
}

function switchPlayer() {
    if (checkWinCondition()) return; // game is over
    
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    console.log("Switching turn to", currentPlayer);
    
    // Start a new turn - reset forced piece if any
    deselectPiece();
    clearHighlights();
    clearMandatoryHighlights();
    
    // Check for mandatory captures for the new current player
    updateMandatoryCaptureStatus();
    
    // Check for game over again (no moves for new player)
    if (checkWinCondition()) return;
    
    // End of previous turn, start of new turn
    turnInProgress = false;
    
    // If new player is AI, make AI move
    if (currentPlayer === aiPlayerColor && !aiThinking) {
        setTimeout(makeAIMove, 500);
    }
}

function updateMandatoryCaptureStatus() {
    // This now uses the detailed structure from findAllPossibleCaptures
    const capturesInfo = findAllPossibleCaptures(currentPlayer);
    availableCaptures = capturesInfo; // Store the detailed info
    mustCapture = capturesInfo.length > 0;

    clearMandatoryHighlights(); // Clear previous highlights
    if (mustCapture) {
        console.log(`Mandatory capture for ${currentPlayer}! Pieces/Sequences:`, availableCaptures);
        highlightMandatoryPieces(); // Highlight pieces that MUST capture
    } else {
        console.log(`No mandatory captures for ${currentPlayer}.`);
    }
}

function findAllPossibleCaptures(player) {
    const allCaptureSequences = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const piece = boardState[r][c];
            if (piece && piece.color === player) {
                // Find all possible capture sequences starting from this piece
                const sequences = findCaptureSequencesForPiece(r, c, piece.isKing, piece.color);
                if (sequences.length > 0) {
                    // Store the starting piece info along with its possible sequences
                    allCaptureSequences.push({ startRow: r, startCol: c, isKing: piece.isKing, sequences: sequences });
                }
            }
        }
    }
    return allCaptureSequences; // Return structure containing pieces and their sequences
}

// Finds all possible capture sequences for a single piece
// Returns an array of sequences, where each sequence is an array of steps
// [{ toRow, toCol, capturedPiece: {r, c} }, ...]
function findCaptureSequencesForPiece(startRow, startCol, isKing, pieceColor) {
    const allSequences = [];
    const opponentColor = pieceColor === 'white' ? 'black' : 'white';
    const directions = [
        { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, // Forward-Left, Forward-Right (relative to white)
        { dr: 1, dc: -1 }, { dr: 1, dc: 1 }   // Backward-Left, Backward-Right (relative to white)
    ];

    // Recursive function to find capture paths
    // boardSnapshot simulates board state during the sequence to avoid capturing the same piece twice
    function findPath(currentRow, currentCol, currentSequence, capturedPiecesSet, boardSnapshot, currentIsKing) {
        let foundFurtherCapture = false;

        for (const dir of directions) {
            let jumpedPieceInfo = null;
            let landRow, landCol;

            if (currentIsKing) {
                // King capture logic: Scan along diagonal
                let scanRow = currentRow + dir.dr;
                let scanCol = currentCol + dir.dc;
                let potentialJump = null;

                while (isValidSquare(scanRow, scanCol)) {
                    const pieceOnSquare = boardSnapshot[scanRow]?.[scanCol];
                    if (pieceOnSquare) {
                        if (pieceOnSquare.color === pieceColor) {
                            break; // Blocked by own piece
                        } else {
                            // Found opponent piece
                            if (potentialJump) break; // Cannot jump over two pieces in one line segment
                             potentialJump = { r: scanRow, c: scanCol };
                        }
                    } else {
                        // Empty square after jumping an opponent piece
                        if (potentialJump) {
                            // Check if this piece was already captured in this sequence
                            const capturedKey = `${potentialJump.r}-${potentialJump.c}`;
                             if (!capturedPiecesSet.has(capturedKey)) {
                                foundFurtherCapture = true;
                                const nextBoardSnapshot = JSON.parse(JSON.stringify(boardSnapshot)); // Deep copy
                                nextBoardSnapshot[potentialJump.r][potentialJump.c] = null; // Remove captured piece for this path
                                nextBoardSnapshot[currentRow][currentCol] = null; // Vacate starting square for this jump
                                nextBoardSnapshot[scanRow][scanCol] = {color: pieceColor, isKing: true}; // Move king temporarily

                                const nextSequence = [...currentSequence, { toRow: scanRow, toCol: scanCol, capturedPiece: potentialJump }];
                                const nextCapturedPieces = new Set(capturedPiecesSet).add(capturedKey);

                                // Continue checking from this landing spot
                                findPath(scanRow, scanCol, nextSequence, nextCapturedPieces, nextBoardSnapshot, true);
                            }
                        }
                    }
                    scanRow += dir.dr;
                    scanCol += dir.dc;
                }

            } else {
                // Man capture logic (only adjacent jumps)
                const jumpOverRow = currentRow + dir.dr;
                const jumpOverCol = currentCol + dir.dc;
                landRow = currentRow + 2 * dir.dr;
                landCol = currentCol + 2 * dir.dc;

                if (isValidSquare(landRow, landCol) && boardSnapshot[landRow][landCol] === null) {
                    const jumpedPiece = boardSnapshot[jumpOverRow]?.[jumpOverCol];
                    if (jumpedPiece && jumpedPiece.color === opponentColor) {
                         jumpedPieceInfo = { r: jumpOverRow, c: jumpOverCol };
                         // Check if this piece was already captured in this sequence
                         const capturedKey = `${jumpedPieceInfo.r}-${jumpedPieceInfo.c}`;
                        if (!capturedPiecesSet.has(capturedKey)) {
                            foundFurtherCapture = true;
                             const nextBoardSnapshot = JSON.parse(JSON.stringify(boardSnapshot)); // Deep copy
                             nextBoardSnapshot[jumpedPieceInfo.r][jumpedPieceInfo.c] = null; // Remove captured piece for this path
                             nextBoardSnapshot[currentRow][currentCol] = null; // Vacate start square
                             nextBoardSnapshot[landRow][landCol] = {color: pieceColor, isKing: false}; // Place piece temporarily

                            const nextSequence = [...currentSequence, { toRow: landRow, toCol: landCol, capturedPiece: jumpedPieceInfo }];
                            const nextCapturedPieces = new Set(capturedPiecesSet).add(capturedKey);

                            // Check for promotion mid-jump
                            const promotedMidJump = !isKing && ((pieceColor === 'white' && landRow === 0) || (pieceColor === 'black' && landRow === ROWS - 1));
                            if (promotedMidJump) {
                                // Continue capturing AS A KING from this spot
                                findPath(landRow, landCol, nextSequence, nextCapturedPieces, nextBoardSnapshot, true); // Now a king
                            } else {
                                 // Continue capturing as a man
                                findPath(landRow, landCol, nextSequence, nextCapturedPieces, nextBoardSnapshot, false);
                            }
                        }
                    }
                }
            }
        }

        // If no further captures were found from this position, this sequence ends here.
        if (!foundFurtherCapture && currentSequence.length > 0) {
            allSequences.push(currentSequence);
        }
    }

    // Start the recursive search
    findPath(startRow, startCol, [], new Set(), JSON.parse(JSON.stringify(boardState)), isKing); // Use deep copy of board state

    return allSequences;
}

// Finds ONLY the IMMEDIATE next possible capture steps from a given position
// Returns an array of single steps: [{ toRow, toCol, isCapture: true, capturedPiece: {r, c} }]
function findImmediateCaptures(startRow, startCol, isKing, pieceColor) {
    const immediateCaptures = [];
    const opponentColor = pieceColor === 'white' ? 'black' : 'white';
    const directions = [
        { dr: -1, dc: -1 }, { dr: -1, dc: 1 },
        { dr: 1, dc: -1 }, { dr: 1, dc: 1 }
    ];

    for (const dir of directions) {
        if (isKing) {
            // King immediate capture logic
            let scanRow = startRow + dir.dr;
            let scanCol = startCol + dir.dc;
            let potentialJump = null;
            while (isValidSquare(scanRow, scanCol)) {
                const pieceOnSquare = boardState[scanRow]?.[scanCol];
                if (pieceOnSquare) {
                    if (pieceOnSquare.color === pieceColor) {
                        break; // Blocked by own piece
                    } else {
                        // Found opponent piece
                        if (potentialJump) break; // Cannot jump two pieces in line
                        potentialJump = { r: scanRow, c: scanCol };
                    }
                } else {
                    // Empty square after finding an opponent piece to jump
                    if (potentialJump) {
                        // Found a landing spot for an immediate king jump
                        immediateCaptures.push({
                            toRow: scanRow,
                            toCol: scanCol,
                            isCapture: true,
                            capturedPiece: potentialJump
                        });
                        // Kings can choose where to land, but for finding *if* a capture is possible,
                        // finding the first landing spot is enough. We stop scanning further along this direction
                        // for *this specific function's purpose* (finding if *any* capture exists).
                        // The actual move execution might allow landing further.
                         // Correction: Need to find ALL possible landing spots for highlight
                         // Continue scanning after the jump
                         // break; // Removed break to find all landing spots
                    }
                }
                scanRow += dir.dr;
                scanCol += dir.dc;
            }
        } else {
            // Man immediate capture logic
            const jumpOverRow = startRow + dir.dr;
            const jumpOverCol = startCol + dir.dc;
            const landRow = startRow + 2 * dir.dr;
            const landCol = startCol + 2 * dir.dc;

            if (isValidSquare(landRow, landCol) && boardState[landRow][landCol] === null) {
                const jumpedPiece = boardState[jumpOverRow]?.[jumpOverCol];
                if (jumpedPiece && jumpedPiece.color === opponentColor) {
                    immediateCaptures.push({
                        toRow: landRow,
                        toCol: landCol,
                        isCapture: true,
                        capturedPiece: { r: jumpOverRow, c: jumpOverCol }
                    });
                }
            }
        }
    }
    return immediateCaptures;
}

function calculateValidMoves(row, col, isKing, _ignoreGlobalMandatory = false) {
    const moves = [];
    const pieceColor = boardState[row][col]?.color;
    if (!pieceColor) return moves;

    // Determine if any captures are mandatory for the *current player* globally,
    // unless we are checking for further captures mid-turn (_ignoreGlobalMandatory)
    let capturesAreGloballyMandatory = false;
    if (!_ignoreGlobalMandatory) {
        capturesAreGloballyMandatory = findAllPossibleCaptures(currentPlayer).length > 0;
    }

    // --- Calculate Immediate Captures from this square ---
    const immediateCaptures = findImmediateCaptures(row, col, isKing, pieceColor);

    // If captures are globally mandatory, only return captures (if this piece has any)
    if (capturesAreGloballyMandatory) {
        return immediateCaptures; // Return only immediate captures for this piece
    }

    // If this piece has immediate captures (even if not globally mandatory, e.g., mid-sequence),
    // return only those captures.
    if (immediateCaptures.length > 0) {
        return immediateCaptures;
    }

    // --- Calculate Non-Capture Moves (only if no captures possible for this piece and not globally mandatory) ---
    const opponentColor = pieceColor === 'white' ? 'black' : 'white';
    const directions = [
         { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, // Forward-Left, Forward-Right
         { dr: 1, dc: -1 }, { dr: 1, dc: 1 }    // Backward-Left, Backward-Right
    ];
    // Men only move forward, Kings move any direction
    const moveDirections = isKing
        ? directions
        : (pieceColor === 'white' ? [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }] : [{ dr: 1, dc: -1 }, { dr: 1, dc: 1 }]);

    for (const dir of moveDirections) {
        let currentRow = row + dir.dr;
        let currentCol = col + dir.dc;

        while (isValidSquare(currentRow, currentCol)) {
            if (boardState[currentRow][currentCol] === null) {
                // Add the single step non-capture move
                moves.push({ toRow: currentRow, toCol: currentCol, isCapture: false, capturedPiece: null });
                if (!isKing) break; // Men only move one step
                // Continue for king along the diagonal
                currentRow += dir.dr;
                currentCol += dir.dc;
            } else {
                break; // Path blocked
            }
        }
    }
    return moves;
}

function isValidSquare(row, col) {
    return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function clearHighlights() {
    // Add debugging to help track when highlights are cleared
    console.log("Clearing all highlights");
    
    document.querySelectorAll('.valid-move, .valid-capture').forEach(el => {
        el.classList.remove('valid-move', 'valid-capture');
        if (el.dataset.moveInfo) {
        delete el.dataset.moveInfo;
        }
    });
}

function highlightMandatoryPieces() {
    // Highlights pieces that have available capture sequences
    const piecesToHighlight = new Set();
    availableCaptures.forEach(captureInfo => { // Iterate through the new structure
        const pieceElement = boardState[captureInfo.startRow]?.[captureInfo.startCol]?.element;
        if (pieceElement) {
            piecesToHighlight.add(pieceElement);
        }
    });
     // Add a visual cue (e.g., class) to the pieces themselves
    piecesToHighlight.forEach(el => el.classList.add('mandatory-capture-piece')); // Add class
    // Add CSS in style.css: .mandatory-capture-piece { border: 3px solid red !important; }
}

function clearMandatoryHighlights() {
     document.querySelectorAll('.mandatory-capture-piece').forEach(el => {
        el.classList.remove('mandatory-capture-piece');
    });
}

function checkWinCondition() {
    // Check if the current player (whose turn it just became) has any valid moves
    const possibleMoves = findAllPossibleMoves(currentPlayer);
    if (possibleMoves.length === 0) {
        const winner = currentPlayer === 'white' ? 'Black' : 'White';
        console.log(`Game Over! ${winner} wins!`);
        showGameResult(winner === 'White' ? 'white' : 'black');
        return true;
    }
    return false;
}

function findAllPossibleMoves(player) {
    const allMoves = [];
     const captures = findAllPossibleCaptures(player);
     if (captures.length > 0) {
         // Only capture moves are allowed
         captures.forEach(capInfo => {
             capInfo.sequences.forEach(seq => {
                 allMoves.push({
                     startRow: capInfo.startRow,
                     startCol: capInfo.startCol,
                     toRow: seq[seq.length - 1].toRow, // Final landing spot
                     toCol: seq[seq.length - 1].toCol,
                     isCapture: true,
                     sequence: seq
                 });
             });
         });
     } else {
         // Find normal moves if no captures are mandatory
         for (let r = 0; r < ROWS; r++) {
             for (let c = 0; c < COLS; c++) {
                 const piece = boardState[r][c];
                 if (piece && piece.color === player) {
                     const normalMoves = calculateValidMoves(r, c, piece.isKing, false); // Get non-capture moves
                     normalMoves.forEach(move => {
                         if (!move.isCapture) { // Ensure it's not accidentally including captures
                             allMoves.push({
                                 startRow: r,
                                 startCol: c,
                                 ...move // includes toRow, toCol, isCapture=false, sequence=null
                             });
                         }
                     });
                 }
             }
         }
     }
    return allMoves;
}

// --- Function to save current state ---
function saveState() {
    // If the current player is white (human player's turn)
    if (currentPlayer === 'white') {
        previousPlayerBoardState = JSON.parse(JSON.stringify(boardState)); // Deep copy
        previousPlayerCurrentPlayer = currentPlayer;
    } 
    // If the current player is black (AI's turn)
    else if (currentPlayer === 'black') {
        previousComputerBoardState = JSON.parse(JSON.stringify(boardState)); // Deep copy
        previousComputerCurrentPlayer = currentPlayer;
    }
}

// --- Function to restore previous state ---
function restorePreviousState() {
    // We want to restore to the state before the human player made their move
    if (!previousPlayerBoardState) {
        console.log("No previous state to restore.");
        return;
    }

    // Restore player to white (human player)
    currentPlayer = 'white';

    // Restore board state (deep copy back)
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            boardState[r][c] = previousPlayerBoardState[r][c] ? { ...previousPlayerBoardState[r][c] } : null;
        }
    }

    // Redraw board based on restored state
    redrawBoardFromState();

    // Clear selection and highlights
    deselectPiece();
    clearHighlights();
    clearMandatoryHighlights();

    // Recalculate mandatory captures for the restored state
    updateMandatoryCaptureStatus();

    console.log("Restored previous state to before human player's move.");
    
    // Clear the saved states
    previousPlayerBoardState = null;
    previousPlayerCurrentPlayer = null;
    previousComputerBoardState = null;
    previousComputerCurrentPlayer = null;
    
    // Re-enable board interaction if it was disabled by win condition
    boardElement.style.pointerEvents = 'auto';
    document.getElementById('undo-btn').disabled = false;
}

// --- Function to redraw the entire board based on boardState --- 
function redrawBoardFromState() {
    boardElement.innerHTML = ''; // Clear the board DOM
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.dataset.row = r;
            square.dataset.col = c;

            const isDark = (r + c) % 2 === 1;
            square.classList.add(isDark ? 'dark' : 'light');

            if (isDark) {
                 // Add piece if exists in state
                 const pieceData = boardState[r][c];
                 if (pieceData) {
                    // Re-create piece element and add listeners
                     const piece = document.createElement('div');
                     piece.classList.add('piece', `${pieceData.color}-piece`);
                     piece.dataset.color = pieceData.color;
                     if (pieceData.isKing) {
                        piece.classList.add('king');
                     }
                     square.appendChild(piece);
                     // IMPORTANT: Re-assign the element reference in the board state
                     boardState[r][c].element = piece;
                     piece.addEventListener('click', handlePieceClick);
                     piece.addEventListener('touchstart', handleTouchStart, { passive: false });
                     piece.addEventListener('mousedown', handleMouseDown, { passive: false });
                 }
                 // Add square listeners only to dark squares
                square.addEventListener('click', handleSquareClick);
            }
            boardElement.appendChild(square);
        }
    }
}

// --- Function to reset the game ---
function resetGame() {
    console.log("Resetting game...");
    currentPlayer = 'white';
    selectedPiece = null;
    mustCapture = false;
    availableCaptures = [];
    
    // Reset state storage variables
    previousPlayerBoardState = null;
    previousPlayerCurrentPlayer = null;
    previousComputerBoardState = null;
    previousComputerCurrentPlayer = null;
    
    boardState.length = 0; // Clear the state array
    turnInProgress = false;
    aiThinking = false;

    createBoard(); // Rebuild the board and initial state
    updateMandatoryCaptureStatus(); // Check initial mandatory captures for white
    clearHighlights();
    clearMandatoryHighlights();
     // Re-enable board interaction
    boardElement.style.pointerEvents = 'auto';
    document.getElementById('undo-btn').disabled = false;

    // If White is AI, trigger its first move
    if (currentPlayer === aiPlayerColor) {
         console.log("Starting game with AI move");
         makeAIMove();
    }

    console.log("Game reset.");
}

// --- Initialization ---
// Add event listeners for buttons
document.getElementById('new-game-btn').addEventListener('click', resetGame);
document.getElementById('undo-btn').addEventListener('click', restorePreviousState);

// Add touch listeners to buttons as well for better mobile UX
document.getElementById('new-game-btn').addEventListener('touchstart', (e) => { e.preventDefault(); resetGame(); }, { passive: false });
document.getElementById('undo-btn').addEventListener('touchstart', (e) => { e.preventDefault(); restorePreviousState(); }, { passive: false });

// Добавляем обработчик клика на доску для снятия выбора с шашки
boardElement.addEventListener('click', function(event) {
    // Если клик был прямо на шашку или на клетку, то соответствующие обработчики уже позаботятся об этом
    if (event.target.classList.contains('piece') || event.target.classList.contains('square')) {
        return;
    }
    
    // Если клик был на пустом месте доски и есть выбранная шашка - снимаем выбор
    if (selectedPiece && !isDragging && !isMouseDragging && !aiThinking && !ignoreNextClick) {
        console.log("Deselecting piece via board click");
        deselectPiece();
    }
});

// Добавляем обработчик клика на весь документ для снятия выбора при клике вне доски
document.addEventListener('click', function(event) {
    // Проверяем, был ли клик вне доски
    if (!boardElement.contains(event.target) && 
        !event.target.closest('.control-panel') && // Исключаем клики по панели управления
        !event.target.closest('#game-result-modal')) { // Исключаем клики по модальному окну
        
        // Если есть выбранная шашка - снимаем выбор
        if (selectedPiece && !isDragging && !isMouseDragging && !aiThinking && !ignoreNextClick) {
            console.log("Deselecting piece via document click (outside board)");
            deselectPiece();
        }
    }
});

createBoard();
// Initial status check is now done inside the first switchPlayer call if needed,
// but better to call it explicitly after board creation for white's first turn.
updateMandatoryCaptureStatus();
console.log("Board created. Initial state:", boardState);
console.log("Current turn:", currentPlayer);

// Show mandatory captures if present
if (mustCapture) {
    console.log("White has mandatory captures on the first turn.");
}

// Initial AI turn if AI is white
if (currentPlayer === aiPlayerColor) {
    makeAIMove();
}

function loadLastPosition() {
    // ... existing code ...
    
    // If it's AI's turn after loading, trigger AI move
    if (currentPlayer === aiPlayerColor && !aiThinking) {
        setTimeout(makeAIMove, 500);
    }
}

// Add animation for piece movement
function animateMove(element, toRow, toCol) {
    element.style.transition = 'transform 0.3s ease-out';
    element.style.transform = 'scale(1.1)';
    
    setTimeout(() => {
        element.style.transform = '';
    }, 300);
}

// --- Touch Drag and Drop Handlers ---

function handleTouchStart(event) {
    // Игнорируем, если игра окончена, ход AI, или уже идет перетаскивание
    if (checkWinCondition() || currentPlayer === aiPlayerColor || isDragging || isMouseDragging || aiThinking) return;

    const originalPieceElement = event.target;
    // Убеждаемся, что касание на шашке
    if (!originalPieceElement.classList.contains('piece')) return;
    
    const squareElement = originalPieceElement.closest('.square');
    if (!squareElement) return;

    // Store the start time and position to detect if it's a tap or drag
    const touchStartTime = Date.now();
    const touch = event.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    // Prevents scrolling but allows tap detection
    if (event.cancelable) {
        event.preventDefault();
    }

    const startRow = parseInt(squareElement.dataset.row);
    const startCol = parseInt(squareElement.dataset.col);
    const pieceData = boardState[startRow][startCol];

    // Проверяем, что это шашка текущего игрока
    if (!pieceData || pieceData.color !== currentPlayer) return;

    // Проверяем, выбрана ли уже эта шашка
    const isPieceAlreadySelected = selectedPiece && selectedPiece.row === startRow && selectedPiece.col === startCol;

    // Проверяем, есть ли у шашки возможные ходы
    const possibleMoves = calculateValidMoves(startRow, startCol, pieceData.isKing);
    if (possibleMoves.length === 0) {
        console.log("У этой шашки нет возможных ходов");
        if (mustCapture) {
            highlightMandatoryPieces();
        }
        return; // Не выбираем и не перетаскиваем шашку без ходов
    }

    // Сохраняем данные о потенциально перетаскиваемой шашке
    draggedPieceData = {
        element: originalPieceElement,
        startRow: startRow,
        startCol: startCol,
        isKing: pieceData.isKing,
        color: pieceData.color
    };

    // Handle click vs. drag detection using touchend instead of a timeout
    const handleTouchEndForTap = function(endEvent) {
        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - touchStartTime;
        
        // Find the specific touch that ended
        let endTouch;
        for (let i = 0; i < endEvent.changedTouches.length; i++) {
            if (endEvent.changedTouches[i].identifier === touch.identifier) {
                endTouch = endEvent.changedTouches[i];
                break;
            }
        }
        
        if (!endTouch) {
            return;
        }
        
        // Calculate distance moved
        const distX = Math.abs(endTouch.clientX - startX);
        const distY = Math.abs(endTouch.clientY - startY);
        
        // If it was a short tap without much movement, treat as click
        if (touchDuration < 200 && distX < 10 && distY < 10) {
            // It was just a tap
            if (isPieceAlreadySelected) {
                console.log(`Отмена выбора шашки на ${startRow}, ${startCol} через тап`);
                deselectPiece();
            } else {
                // If this is a new piece, select it
                console.log(`Выбираем шашку на ${startRow}, ${startCol}`);
                selectPiece(originalPieceElement, startRow, startCol, pieceData.isKing);
            }
            
            // Clean up without starting drag operation
            if (draggedPieceData) {
                draggedPieceData = null;
            }
            
            touchIdentifier = null;
            
            // Prevent default to avoid further handling
            if (endEvent.cancelable) {
                endEvent.preventDefault();
            }
        }
        
        // Remove this one-time handler
        document.removeEventListener('touchend', handleTouchEndForTap);
    };
    
    // Add a one-time touchend listener to detect if it's a tap
    document.addEventListener('touchend', handleTouchEndForTap, { once: true, passive: false });

    // Получаем позицию для перетаскивания
    const rect = originalPieceElement.getBoundingClientRect();
    touchIdentifier = touch.identifier;
    initialTouchX = touch.clientX;
    initialTouchY = touch.clientY;
    initialPieceOffsetX = initialTouchX - rect.left;
    initialPieceOffsetY = initialTouchY - rect.top;

    // Добавляем обработчики для перемещения и окончания касания
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

function handleTouchMove(event) {
    // Clear any tap detection - it's definitely a drag now
    
    if (!draggedPieceData) return; // Should have data if touch started correctly

    // Find the specific touch that started the drag
    const touch = Array.from(event.touches).find(t => t.identifier === touchIdentifier);
    if (!touch) return;

    // Prevent scrolling
    if (event.cancelable) {
        event.preventDefault();
    }

    // Only create drag element on first actual move *if not already created*
    if (!isDragging) {
        isDragging = true; // Set flag to indicate drag has started

        // --- Add dragging class to the original piece ---
        if (draggedPieceData && draggedPieceData.element) {
            draggedPieceData.element.classList.add('dragging');
        }

        // --- Clone Creation Code ---
        const pieceElement = draggedPieceData.element;
        const rect = pieceElement.getBoundingClientRect();
        
        draggedPieceElement = pieceElement.cloneNode(true); // Clone the original piece
        draggedPieceElement.classList.remove('dragging'); // Remove from clone if already added
        draggedPieceElement.classList.add('dragging-piece'); // Add specific drag clone style
        draggedPieceElement.style.width = `${rect.width}px`;
        draggedPieceElement.style.height = `${rect.height}px`;
        draggedPieceElement.style.position = 'fixed'; // Use fixed for viewport positioning
        draggedPieceElement.style.pointerEvents = 'none'; // Ignore pointer events on clone
        draggedPieceElement.style.zIndex = '1000';
        draggedPieceElement.style.opacity = '1'; // Ensure clone is fully visible
        draggedPieceElement.style.left = `${rect.left}px`; // Initial position
        draggedPieceElement.style.top = `${rect.top}px`;
        
        // Add crown if king (efficiently, checks data)
        if (draggedPieceData.isKing) {
            const crown = document.createElement('div');
            crown.textContent = '👑';
            crown.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: ${window.innerWidth <= 600 ? '18px' : '24px'};
                z-index: 2;
                text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
                filter: drop-shadow(0 0 4px gold);
            `;
            draggedPieceElement.appendChild(crown);
        }
        
        // Slightly hide the original piece
        pieceElement.style.opacity = '0.3';
        
        // Append clone to body
        document.body.appendChild(draggedPieceElement);
    }

    if (!draggedPieceElement) return; // Should exist now if dragging

    // Get board boundaries to keep piece within board visually
    const boardRect = boardElement.getBoundingClientRect();
    
    // Calculate new position
    let newX = touch.clientX - initialPieceOffsetX;
    let newY = touch.clientY - initialPieceOffsetY;
    
    // Get the element's dimensions
    const pieceWidth = draggedPieceElement.offsetWidth;
    const pieceHeight = draggedPieceElement.offsetHeight;
    
    // Keep the piece within the board boundaries
    newX = Math.max(boardRect.left, Math.min(newX, boardRect.right - pieceWidth));
    newY = Math.max(boardRect.top, Math.min(newY, boardRect.bottom - pieceHeight));
    
    // Update position using requestAnimationFrame for smoother rendering
    requestAnimationFrame(() => {
        if (draggedPieceElement) { // Check again in case it was removed
    draggedPieceElement.style.left = `${newX}px`;
    draggedPieceElement.style.top = `${newY}px`;
        }
    });
}

function handleTouchEnd(event) {
    // If there's no drag operation in progress, exit early
    if (!draggedPieceData || !isDragging) {
        // Only cleanup event listeners if we have drag data
        if (draggedPieceData) {
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('touchcancel', handleTouchEnd);
            
            // Clear drag data but don't affect piece selection
            draggedPieceData = null;
            touchIdentifier = null;
        }
        return;
    }
    
    // Prevent default behavior if possible
    if (event.cancelable) {
        event.preventDefault();
    }

    let moveMade = false;
    
    // Find the specific touch that ended
    let touch;
    for (let i = 0; i < event.changedTouches.length; i++) {
        if (event.changedTouches[i].identifier === touchIdentifier) {
            touch = event.changedTouches[i];
            break;
        }
    }
    
    if (!touch) {
        // If the ending touch doesn't match the starting one (unlikely but possible), clean up
        cleanupDragOperation(false);
        return;
    }

    // Get drop location
    const endX = touch.clientX;
    const endY = touch.clientY;
    
    // --- Snap-to-Square Logic ---
    const boardRect = boardElement.getBoundingClientRect();
    const squareSize = boardRect.width / COLS; // Assuming square board

    // Calculate potential row/col based on drop position relative to board
    const relativeX = endX - boardRect.left;
    const relativeY = endY - boardRect.top;
    const potentialCol = Math.floor(relativeX / squareSize);
    const potentialRow = Math.floor(relativeY / squareSize);

    // Find the center of the potential target square
    const targetSquareCenterX = boardRect.left + (potentialCol + 0.5) * squareSize;
    const targetSquareCenterY = boardRect.top + (potentialRow + 0.5) * squareSize;

    // Calculate distance from drop point to square center
    const distance = Math.sqrt(Math.pow(endX - targetSquareCenterX, 2) + Math.pow(endY - targetSquareCenterY, 2));

    // Temporarily hide clone to find element underneath more reliably if needed
    draggedPieceElement.style.display = 'none';
    const elementUnderMouse = document.elementFromPoint(endX, endY); // Check direct element first
    draggedPieceElement.style.display = ''; // Show again

    // Prioritize the calculated square if the drop is reasonably close
    const SNAP_THRESHOLD = squareSize * 0.75; // Drop within 3/4 of square size from center
    let targetSquare = null;

    if (distance < SNAP_THRESHOLD && isValidSquare(potentialRow, potentialCol)) {
        // Get the square element based on calculated row/col
        targetSquare = getSquareElement(potentialRow, potentialCol);
    } else if (elementUnderMouse) {
        // Fallback: Check element directly under pointer if snap failed or too far
        targetSquare = elementUnderMouse.closest('.square.dark');
    }

    if (targetSquare) {
        const endRow = parseInt(targetSquare.dataset.row);
        const endCol = parseInt(targetSquare.dataset.col);
            
        // Check if this target square is a valid move
        const validMoves = calculateValidMoves(draggedPieceData.startRow, draggedPieceData.startCol, draggedPieceData.isKing);
        const validMoveInfo = validMoves.find(move => move.toRow === endRow && move.toCol === endCol);

        if (validMoveInfo) {
            // Execute the move
            movePiece(draggedPieceData.startRow, draggedPieceData.startCol, endRow, endCol, validMoveInfo);
            moveMade = true;
        }
    }

    // Full cleanup for drag end (successful or failed move)
    cleanupDragOperation(moveMade);
}

// Helper function to clean up after drag operations
function cleanupDragOperation(successful) {
    console.log("Cleaning up drag operation. States before cleanup:", {isDragging, isMouseDragging, draggedPieceData});
    
    // Remove the dragged element
    if (draggedPieceElement && draggedPieceElement.parentNode) {
        document.body.removeChild(draggedPieceElement);
        draggedPieceElement = null; // Clear reference
    }
    
    // Restore the original piece visibility and remove dragging class
    if (draggedPieceData && draggedPieceData.element) {
        draggedPieceData.element.style.opacity = '1';
        draggedPieceData.element.classList.remove('dragging'); // Remove scaling class
    }
    
    // Clean up highlights and selection if move failed or not completed
    if (!successful) {
        clearHighlights();
        deselectPiece();
    }
    
    // Remove event listeners
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    document.removeEventListener('touchcancel', handleTouchEnd);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // BUGFIX: Reset state variables - ensure they're all properly reset
    isDragging = false;
    isMouseDragging = false;
    draggedPieceData = null;
    touchIdentifier = null;
    
    // Set ignoreNextClick only if the drag was successful and resulted in a move
    if (successful) {
        ignoreNextClick = true;
        // Automatically reset it after a short delay
        setTimeout(() => { ignoreNextClick = false; }, 200);
    } else {
        // If the drag was not successful, don't ignore the next click
        ignoreNextClick = false;
    }
    
    console.log("Drag cleanup complete. States after cleanup:", {isDragging, isMouseDragging, ignoreNextClick});
}

// --- Mouse Drag and Drop Handlers ---

// Check if device supports touch events (mobile/tablet)
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);

function handleMouseDown(event) {
    // Completely disable drag operations on non-touch devices (PC)
    if (!isTouchDevice) {
        // On PC, only allow click selection, not dragging
        return;
    }
    
    // Original drag handling (only for touch devices)
    // Игнорируем, если игра окончена, ход AI, или уже идет перетаскивание
    if (checkWinCondition() || currentPlayer === aiPlayerColor || isDragging || isMouseDragging || aiThinking) return;

    // Для правого клика показываем контекстное меню игры
    if (event.button === 2) {
        showGameContextMenu(event);
        return;
    }

    // Убеждаемся, что клик на шашке
    const originalPieceElement = event.target.closest('.piece');
    if (!originalPieceElement) return;
    
    const squareElement = originalPieceElement.closest('.square');
    if (!squareElement) return;

    // Предотвращаем выделение текста и прочие стандартные действия
    event.preventDefault();

    const startRow = parseInt(squareElement.dataset.row);
    const startCol = parseInt(squareElement.dataset.col);
    const pieceData = boardState[startRow][startCol];

    // Проверяем, что это шашка текущего игрока
    if (!pieceData || pieceData.color !== currentPlayer) return;
    
    // Проверяем, выбрана ли уже эта шашка
    const isPieceAlreadySelected = selectedPiece && selectedPiece.row === startRow && selectedPiece.col === startCol;

    // Проверяем, есть ли у шашки возможные ходы
    const possibleMoves = calculateValidMoves(startRow, startCol, pieceData.isKing);
    if (possibleMoves.length === 0) {
        console.log("У этой шашки нет возможных ходов");
        if (mustCapture) {
            highlightMandatoryPieces();
        }
        return; // Не выбираем и не перетаскиваем шашку без ходов
    }

    // Устанавливаем таймер, чтобы отличить клик от начала перетаскивания
    this.clickTimeout = setTimeout(() => {
        // Если таймер сработал, это был просто клик
        this.clickTimeout = null;
        
        if (!isMouseDragging) {
            // Если был просто клик на уже выбранную шашку, отменяем выбор
            if (isPieceAlreadySelected) {
                console.log(`Отмена выбора шашки на ${startRow}, ${startCol} через клик`);
                deselectPiece();
            }
        }
    }, 150);

    // Сохраняем данные о потенциально перетаскиваемой шашке
    draggedPieceData = {
        element: originalPieceElement,
        startRow: startRow,
        startCol: startCol,
        isKing: pieceData.isKing,
        color: pieceData.color
    };

    // Если мы начинаем перетаскивать уже выбранную шашку, сохраняем выбор
    if (isPieceAlreadySelected) {
        // Шашка уже выбрана, но мы хотим ее перетащить
        console.log("Начинаем перетаскивание уже выбранной шашки");
    } else {
        // Если это новая шашка, выбираем её
        console.log(`Выбираем шашку на ${startRow}, ${startCol}`);
        selectPiece(originalPieceElement, startRow, startCol, pieceData.isKing);
    }

    // Получаем позицию для перетаскивания
    const rect = originalPieceElement.getBoundingClientRect();
    initialMouseX = event.clientX;
    initialMouseY = event.clientY;
    initialPieceOffsetX = initialMouseX - rect.left;
    initialPieceOffsetY = initialMouseY - rect.top;

    // Добавляем обработчики перемещения и отпускания мыши
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(event) {
    // Выходим, если нет данных о перетаскивании
    if (!draggedPieceData) return;

    // Предотвращаем стандартные действия при перетаскивании
    if (event.cancelable) event.preventDefault();

    // Предотвращаем множественные обработки одного и того же события
    if (event.timeStamp === lastMouseMoveTimeStamp) return;
    lastMouseMoveTimeStamp = event.timeStamp;
    
    // Очищаем таймер клика, если он есть - теперь мы точно перетаскиваем
    if (this.clickTimeout) {
        clearTimeout(this.clickTimeout);
        this.clickTimeout = null;
    }
    
    // Вычисляем, насколько сместилась мышь от начального положения
    const deltaX = event.clientX - initialMouseX;
    const deltaY = event.clientY - initialMouseY;
    
    // Если мы еще не начали перетаскивание, проверяем порог перемещения
    if (!isMouseDragging) {
        // Расстояние от начальной точки
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Если расстояние меньше порога, не начинаем перетаскивание
        if (distance < 5) {
            return;
        }
        
        // Начинаем перетаскивание
        isMouseDragging = true;
        startDragging(draggedPieceData.element, 
                      draggedPieceData.startRow, 
                      draggedPieceData.startCol, 
                      draggedPieceData.isKing, 
                      event.clientX, 
                      event.clientY);
    }
    
    // Перемещаем элемент вместе с курсором
    updateDraggedPiecePosition(event.clientX, event.clientY);
}

function handleMouseUp(event) {
    if (!isMouseDragging || !draggedPieceData) {
       // console.log("MouseUp ignored: Not dragging or no data.");
       // Reset potentially stuck state if mouseup occurs unexpectedly
        if (isMouseDragging) {
             console.warn("MouseUp cleanup for potentially stuck drag state.");
             cleanupDragOperation(false); // Assume unsuccessful
        }
        return;
    }
    console.log("handleMouseUp:", event); // Debug log

    // Make the temporary dragged element invisible
    if (draggedPieceElement) {
        draggedPieceElement.style.display = 'none';
    }

    const targetElement = document.elementFromPoint(event.clientX, event.clientY);
    const targetSquare = targetElement ? targetElement.closest('.square') : null;
    let moveSuccessful = false;

    if (targetSquare && targetSquare.dataset.row && targetSquare.dataset.col) {
        const endRow = parseInt(targetSquare.dataset.row);
        const endCol = parseInt(targetSquare.dataset.col);
        const startRow = draggedPieceData.startRow;
        const startCol = draggedPieceData.startCol;

        console.log(`MouseUp: Attempting move from ${startRow},${startCol} to ${endRow},${endCol}`);

        // Validate the move
        const validMoves = calculateValidMoves(startRow, startCol, draggedPieceData.isKing, true); // Ignore global mandatory here
        const moveInfo = validMoves.find(m => m.toRow === endRow && m.toCol === endCol);

        if (moveInfo && (!mustCapture || moveInfo.isCapture)) {
             console.log("MouseUp: Valid move found:", moveInfo);
             // Select the piece *first* if it wasn't the selected one
              if (!selectedPiece || selectedPiece.row !== startRow || selectedPiece.col !== startCol) {
                   if(selectedPiece) deselectPiece();
                   const originalPieceElement = boardState[startRow][startCol]?.element;
                   if(originalPieceElement) {
                       selectPiece(originalPieceElement, startRow, startCol, draggedPieceData.isKing);
        } else {
                        console.error("Cannot find original piece element to select for drag move!");
                   }
              }
              // Now move the (now selected) piece
             if(selectedPiece) { // Ensure selection succeeded
                 movePiece(startRow, startCol, endRow, endCol, moveInfo);
                 moveSuccessful = true;
             } else {
                 console.error("Failed to select piece before executing dragged move.");
             }

        } else {
            console.log("MouseUp: Invalid move.");
            // Snap back animation (optional)
        }
    } else {
         console.log("MouseUp: Not dropped on a valid square.");
        // Dropped outside - snap back (optional)
    }

    // Cleanup drag state
    cleanupDragOperation(moveSuccessful);

    // Reset initial mouse position tracking
    initialMouseX = 0;
    initialMouseY = 0;
    lastMouseMoveTimeStamp = 0;
}

// --- Theme Handling ---
const themeBtn = document.getElementById('theme-btn');
const themeDropdown = document.getElementById('theme-dropdown');
const themeOptions = document.querySelectorAll('.theme-option');
let currentTheme = 'default'; // Default theme

// Check if a theme is stored in localStorage
function initTheme() {
    const savedTheme = localStorage.getItem('checkers-theme');
    // Проверяем, если сохраненная тема - одна из удаленных тем
    if (savedTheme === 'wooden' || savedTheme === 'blue') {
        // Установим тему по умолчанию
        applyTheme('default');
    } else if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme(currentTheme); // Apply default if nothing saved
    }
    
    // Mark the current theme as active in the dropdown
    themeOptions.forEach(option => {
        option.classList.toggle('active', option.dataset.theme === currentTheme);
    });
}

// Toggle the theme dropdown
if (themeBtn && themeDropdown) {
    themeBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent document click listener from closing it immediately
        themeDropdown.classList.toggle('active');
    });
} else {
    console.error("Theme button or dropdown not found!");
}

// Close the dropdown if clicked outside
document.addEventListener('click', (event) => {
    if (themeDropdown && themeDropdown.classList.contains('active') &&
        themeBtn && !themeBtn.contains(event.target) &&
        !themeDropdown.contains(event.target)) {
        themeDropdown.classList.remove('active');
    }
});

// Handle theme selection
if (themeOptions.length > 0) {
    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.dataset.theme;
            applyTheme(theme);
            themeDropdown.classList.remove('active');
            
            // Update active state in dropdown
            themeOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
        });
    });
} else {
    console.error("No theme options found!");
}

// Apply the selected theme
function applyTheme(theme) {
    console.log("Applying theme:", theme);
    // Remove previous theme class from body if it exists
    if (currentTheme && currentTheme !== 'default') {
    document.body.classList.remove(`theme-${currentTheme}`);
    } else {
         // Ensure default theme class is removed if switching from default
         document.body.classList.remove(`theme-default`);
    }
    
    // Add new theme class if it's not the default
    if (theme && theme !== 'default') {
        document.body.classList.add(`theme-${theme}`);
    }
    
    // Update current theme variable
    currentTheme = theme;
    
    // Save to localStorage
    try {
    localStorage.setItem('checkers-theme', theme);
    } catch (e) {
      console.error("Could not save theme to localStorage:", e);
    }
}

// Initialize theme on page load
initTheme();

// Добавляем глобальный обработчик клика для обработки деселекта
document.addEventListener('click', function(event) {
    // Если нет выбранной шашки или ход ИИ или идет анимация - игнорируем
    if (!selectedPiece || aiThinking || isDragging || isMouseDragging) {
        return;
    }
    
    // Проверяем, был ли клик на валидное поле для хода
    const isValidMoveSquare = event.target.classList && 
        (event.target.classList.contains('valid-move') || 
         event.target.classList.contains('valid-capture') ||
         event.target.closest('.valid-move') || 
         event.target.closest('.valid-capture'));
         
    // Если кликнули на саму выбранную шашку (для отмены выбора) - позволяем обработчику шашки это сделать
    const clickedOnSelectedPiece = selectedPiece.element && 
        (event.target === selectedPiece.element || event.target.parentElement === selectedPiece.element);
    
    // Проверим, кликнули ли на другую свою шашку - позволяем обработчику шашки это обработать
    const pieceElement = event.target.closest('.piece');
    const isClickOnOwnPiece = pieceElement && 
                             pieceElement.dataset.color === currentPlayer;
    
    // Если клик не на валидное поле для хода, не на выбранную шашку и не на свою шашку - отменяем выбор
    if (!isValidMoveSquare && !clickedOnSelectedPiece && !isClickOnOwnPiece && !ignoreNextClick) {
        console.log("Global click handler: clicked outside valid move squares, deselecting piece");
        deselectPiece();
    }
});
