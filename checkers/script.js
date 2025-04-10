const boardElement = document.getElementById('checkerboard');
const turnElement = document.getElementById('turn');
const boardState = []; // 8x8 array representing the board
const ROWS = 8;
const COLS = 8;

let currentPlayer = 'white'; // 'white' or 'black'
let selectedPiece = null; // { row, col, element, isKing }
let mustCapture = false; // Flag indicating if a capture is mandatory
let availableCaptures = []; // Array of possible capture sequences
let previousBoardState = null; // Store the state before the last move
let previousCurrentPlayer = null;
let turnInProgress = false; // Flag to manage state saving only once per turn

// --- Game Mode ---
let aiPlayerColor = 'black'; // AI plays as black by default
let aiThinking = false; // Track when AI is calculating its move

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
}

function handlePieceClick(event) {
    event.stopPropagation(); // Prevent square click event from firing
    const pieceElement = event.target;
    const squareElement = pieceElement.parentElement;
    const row = parseInt(squareElement.dataset.row);
    const col = parseInt(squareElement.dataset.col);
    const pieceData = boardState[row][col];

    if (pieceData.color !== currentPlayer) {
        console.log("Not your turn or not your piece.");
        return;
    }

    // If a capture is mandatory, only allow selecting pieces that can capture
    if (mustCapture) {
        const canPieceCapture = availableCaptures.some(capture => capture.startRow === row && capture.startCol === col);
        if (!canPieceCapture) {
            console.log("Mandatory capture: You must select a piece that can capture.");
            return;
        }
    }

    selectPiece(pieceElement, row, col, pieceData.isKing);
}

function handleSquareClick(event) {
    if (!selectedPiece) return; // No piece selected

    const squareElement = event.target.closest('.square'); // Ensure we get the square, even if clicking highlight overlay
    if (!squareElement || squareElement.classList.contains('piece')) return; // Ignore clicks on pieces themselves

    const targetRow = parseInt(squareElement.dataset.row);
    const targetCol = parseInt(squareElement.dataset.col);

    // Check if this square has valid move data stored
    if (!squareElement.dataset.moveInfo) {
         console.log("Invalid move target (no move info)");
         // If clicking an invalid square AFTER selecting a piece that MUST capture, keep it selected.
         // Otherwise, deselect.
         const pieceMustMove = mustCapture && availableCaptures.some(capInfo => capInfo.startRow === selectedPiece.row && capInfo.startCol === selectedPiece.col);
         if (!pieceMustMove) {
             deselectPiece();
         }
         return;
     }


    const moveInfo = JSON.parse(squareElement.dataset.moveInfo);

    // We already validated that this piece *can* be selected in handlePieceClick
    // And highlightValidMoves only shows valid targets based on mandatory capture rules.
    // So, we can proceed with the move.
    movePiece(selectedPiece.row, selectedPiece.col, targetRow, targetCol, moveInfo);
}


function selectPiece(pieceElement, row, col, isKing) {
    deselectPiece(); // Deselect any previously selected piece
    selectedPiece = { row, col, element: pieceElement, isKing };
    pieceElement.classList.add('selected');
    console.log(`Selected piece at (${row}, ${col})`);
    highlightValidMoves(row, col, isKing);
}

function deselectPiece() {
    if (selectedPiece) {
        selectedPiece.element.classList.remove('selected');
    }
    selectedPiece = null;
    // Remove previous highlights
    document.querySelectorAll('.valid-move, .valid-capture').forEach(el => {
        el.classList.remove('valid-move', 'valid-capture');
    });
}

function getSquareElement(row, col) {
    return boardElement.querySelector(`.square[data-row='${row}'][data-col='${col}']`);
}

// --- Game Logic Functions (to be implemented) ---

function highlightValidMoves(row, col, isKing) {
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
}

function movePiece(startRow, startCol, endRow, endCol, moveInfo) {
    console.log(`Executing step:`, moveInfo);

    // Save state *before* the very first action of a turn
    if (!turnInProgress) {
        saveState();
        turnInProgress = true;
    }

    const pieceData = boardState[startRow][startCol];
    const pieceElement = pieceData.element;
    let becameKing = false;

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
    document.querySelectorAll('.valid-move, .valid-capture').forEach(el => {
        el.classList.remove('valid-move', 'valid-capture');
        delete el.dataset.moveInfo;
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
        alert(`Game Over! ${winner} wins!`);
        // TODO: Disable further moves or add a reset button
        boardElement.style.pointerEvents = 'none'; // Simple way to stop interaction
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
    previousBoardState = JSON.parse(JSON.stringify(boardState)); // Deep copy
    previousCurrentPlayer = currentPlayer;
}

// --- Function to restore previous state ---
function restorePreviousState() {
    if (!previousBoardState) {
        console.log("No previous state to restore.");
        return;
    }

    // Restore player
    currentPlayer = previousCurrentPlayer;

    // Restore board state (deep copy back)
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            boardState[r][c] = previousBoardState[r][c] ? { ...previousBoardState[r][c] } : null;
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

    console.log("Restored previous state.");
    // Clear the saved state so undo can only happen once per turn
    previousBoardState = null;
    previousCurrentPlayer = null;
     // Re-enable board interaction if it was disabled by win condition
    boardElement.style.pointerEvents = 'auto';
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
    previousBoardState = null;
    previousCurrentPlayer = null;
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