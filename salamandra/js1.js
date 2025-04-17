/**
 * River Crossing Game - Improved Script
 * Salamander vs Fish Game
 */

// Game constants
const BOARD_SIZE = 8;
const SQUARE_SIZE = 50; // Must match CSS .square width/height
const ANIMATION_DELAY = {
    FISH_MOVE: 150,      // Faster fish move initiation
    FISH_ANIMATION: 250, // Faster fish animation/wait after move
    TURN_TRANSITION: 100 // Faster switch between turns
};

// Game state
const GameState = {
    board: [], // 2D array representing logical game board
    pieces: [], // Array of all piece elements
    selectedPiece: null, // Currently selected piece
    validMoveSquares: [], // Highlighted valid move squares
    gameOver: false, // Flag indicating game end
    currentTurn: 'salamander', // Current turn: 'salamander' or 'fish'
};

// DOM elements cache
const DOM = {
    boardElement: null,
    gameContainer: null,
    resetButton: null,
    
    // Initialize all DOM element references
    init() {
        this.boardElement = document.getElementById('game-board');
        this.gameContainer = document.getElementById('game-container');
        this.resetButton = document.getElementById('reset-button');
    }
};

/**
 * Game Board Setup Functions
 */
const Board = {
    // Create the chess-like game board
    create() {
        console.log("Creating board...");
        DOM.boardElement.innerHTML = ''; // Clear previous board
        
        // Initialize board state with nulls (8x8 array)
        GameState.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

        // Create the visual board squares
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const square = document.createElement('div');
                square.classList.add('square');
                
                // Alternating colors (0,0 is light)
                const isLightSquare = (row + col) % 2 === 0;
                square.classList.add(isLightSquare ? 'light' : 'dark');
                
                // Store position data on the element
                square.dataset.row = row;
                square.dataset.col = col;
                
                DOM.boardElement.appendChild(square);

                // Only dark squares are playable
                if (!isLightSquare) {
                    // Bind GameController context to the handler & add touch support
                    square.addEventListener('click', GameController.handleSquareClick.bind(GameController));
                    square.addEventListener('touchstart', GameController.handleSquareClick.bind(GameController), { passive: true }); // Use passive for performance
                } else {
                    square.style.cursor = 'default';
                }
            }
        }
        
        console.log("Board created");
    },
    
    // Reset the game board to initial state
    reset() {
        // Clear old pieces
        GameState.pieces.forEach(piece => piece.remove());
        GameState.pieces = [];
        
        // Reset game state
        GameState.selectedPiece = null;
        GameState.validMoveSquares = [];
        GameState.gameOver = false;
        GameState.currentTurn = 'salamander';
        
        // Create new board
        this.create();
        
        // Create pieces with initial positions
        this.createInitialPieces();
        
        // Start with salamander's turn
        GameController.startSalamanderTurn();
    },
    
    // Create initial pieces and place them on the board
    createInitialPieces() {
        // Create Salamander at bottom row (row 7, col 0)
        const salamander = PieceFactory.createPiece('salamander', 'salamander', 7, 4);
        if (salamander) GameState.pieces.push(salamander);
        
        // Create Fish at top row (row 0, cols 1,3,5,7)
        const fishPositions = [[0, 1], [0, 3], [0, 5], [0, 7]];
        fishPositions.forEach((pos, index) => {
            const fish = PieceFactory.createPiece('fish', `fish-${index}`, pos[0], pos[1]);
            if (fish) GameState.pieces.push(fish);
        });
        
        console.log("Initial board state:", GameState.board.map(row => row.map(p => p ? p.id : null)));
    }
};

/**
 * Piece management factory
 */
const PieceFactory = {
    // Create a new game piece and add to the board
    createPiece(type, id, startRow, startCol) {
        console.log(`Creating piece: ${type} (${id}) at [${startRow}, ${startCol}]`);
        
        const piece = document.createElement('div');
        piece.classList.add('piece', type);
        piece.id = id;
        piece.dataset.type = type;
        piece.dataset.row = startRow;
        piece.dataset.col = startCol;
        
        // Position the piece visually
        this.positionPiece(piece, startRow, startCol);
        DOM.gameContainer.appendChild(piece);
        
        // Update the logical board state
        if (GameState.board[startRow] && GameState.board[startRow][startCol] === null) {
            GameState.board[startRow][startCol] = piece;
        } else {
            console.error(`Error placing ${type} at [${startRow}, ${startCol}]: Position invalid or occupied`);
            return null;
        }
        
        // Add click and touch event listener
        // Bind GameController context to the handler
        piece.addEventListener('click', GameController.handlePieceClick.bind(GameController));
        piece.addEventListener('touchstart', GameController.handlePieceClick.bind(GameController), { passive: true }); // Use passive for performance
        
        return piece;
    },
    
    // Position a piece on the visual board
    positionPiece(pieceElement, row, col) {
        // Center the piece (40px) in square (50px)
        const top = row * SQUARE_SIZE + (SQUARE_SIZE - 40) / 2;
        const left = col * SQUARE_SIZE + (SQUARE_SIZE - 40) / 2;
        
        pieceElement.style.top = `${top}px`;
        pieceElement.style.left = `${left}px`;
    },
    
    // Move a piece to a new position (updates both logical and visual state)
    movePiece(piece, newRow, newCol) {
        const oldRow = parseInt(piece.dataset.row);
        const oldCol = parseInt(piece.dataset.col);
        
        console.log(`Moving ${piece.id} from [${oldRow}, ${oldCol}] to [${newRow}, ${newCol}]`);
        
        // Update logical board state
        if (!this.updateBoardState(piece, oldRow, oldCol, newRow, newCol)) {
            return false;
        }
        
        // Update piece data attributes
        piece.dataset.row = newRow;
        piece.dataset.col = newCol;
        
        // Update visual position
        this.positionPiece(piece, newRow, newCol);
        
        return true;
    },
    
    // Update the logical board state when a piece moves
    updateBoardState(piece, oldRow, oldCol, newRow, newCol) {
        // Clear old position
        if (GameState.board[oldRow] && GameState.board[oldRow][oldCol] === piece) {
            GameState.board[oldRow][oldCol] = null;
        } else {
            console.warn(`Board inconsistency: ${piece.id} not found at expected position [${oldRow},${oldCol}]`);
            
            // Try to find and clear the piece from its actual position
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (GameState.board[r][c] === piece) {
                        console.warn(`Found ${piece.id} at unexpected [${r},${c}]. Clearing it.`);
                        GameState.board[r][c] = null;
                        break;
                    }
                }
            }
            
            // Still clear original position as fallback
            if (GameState.board[oldRow]) GameState.board[oldRow][oldCol] = null;
        }
        
        // Set new position
        if (GameState.board[newRow] && GameState.board[newRow][newCol] === null) {
            GameState.board[newRow][newCol] = piece;
            return true;
        } else {
            console.error(`Cannot place ${piece.id} at [${newRow},${newCol}]: Position invalid or occupied`);
            return false;
        }
    }
};

/**
 * Game moves and validation
 */
const MovesCalculator = {
    // Get valid moves for a piece
    getValidMoves(piece) {
        const validMoves = [];
        const row = parseInt(piece.dataset.row);
        const col = parseInt(piece.dataset.col);
        const type = piece.dataset.type;
        
        // Define possible move directions based on piece type
        let directions = [];
        
        if (type === 'salamander') {
            // Salamander can move diagonally in all directions
            directions = [
                [-1, -1], [-1, 1], // Forward (up)
                [1, -1], [1, 1]    // Backward (down)
            ];
        } else if (type === 'fish') {
            // Fish can only move diagonally forward (down)
            directions = [
                [1, -1], [1, 1]
            ];
        } else {
            console.error("Unknown piece type:", type);
            return [];
        }
        
        // Check each possible direction
        directions.forEach(([dRow, dCol]) => {
            const newRow = row + dRow;
            const newCol = col + dCol;
            
            // Check if within board boundaries
            if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
                // Check if target is a dark square
                if ((newRow + newCol) % 2 !== 0) {
                    // Check if target square is empty
                    if (GameState.board[newRow] && GameState.board[newRow][newCol] === null) {
                        validMoves.push([newRow, newCol]);
                    }
                }
            }
        });
        
        return validMoves;
    },
    
    // Check if the salamander is trapped (no valid moves)
    isSalamanderTrapped() {
        const salamander = document.getElementById('salamander');
        if (!salamander) {
            console.error("Salamander element not found");
            return false;
        }
        
        const moves = this.getValidMoves(salamander);
        return moves.length === 0;
    },
    
    // Highlight valid move squares on the board
    highlightValidMoves(moves) {
        // Clear previous highlights
        GameState.validMoveSquares.forEach(square => square.classList.remove('valid-move'));
        GameState.validMoveSquares = [];
        
        // Add new highlights
        moves.forEach(([row, col]) => {
            const squareElement = DOM.boardElement.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
            if (squareElement) {
                squareElement.classList.add('valid-move');
                GameState.validMoveSquares.push(squareElement);
            }
        });
    },
    
    // Clear selected piece and highlighted moves
    clearSelectionAndHighlights() {
        if (GameState.selectedPiece) {
            GameState.selectedPiece.classList.remove('selected');
        }
        
        GameState.validMoveSquares.forEach(square => square.classList.remove('valid-move'));
        GameState.validMoveSquares = [];
        GameState.selectedPiece = null;
    }
};

// Add a flag to prevent double handling of click/touch
let handlingEvent = false;

/**
 * Game flow controller
 */
const GameController = {
    // Initialize the game
    init() {
        DOM.init();
        Board.reset(); // Create the initial board and pieces
        this.setupEventListeners();
        this.startSalamanderTurn();
    },
    
    // Set up all event listeners
    setupEventListeners() {
        document.getElementById('reset-button').addEventListener('click', () => {
            this.reset();
        });
        
        document.getElementById('victory-play-again').addEventListener('click', () => {
            this.hideGameOverWindows();
            this.reset();
        });
        
        document.getElementById('defeat-play-again').addEventListener('click', () => {
            this.hideGameOverWindows();
            this.reset();
        });
    },
    
    // Reset the game
    reset() {
        Board.reset();
    },
    
    // Start salamander's turn
    startSalamanderTurn() {
        GameState.currentTurn = 'salamander';
        console.log("--- Salamander's turn --- Player actions enabled");
    },
    
    // Start fish's turn
    startFishTurn() {
        GameState.currentTurn = 'fish';
        console.log("--- Fish turn started --- Player actions blocked");
        
        // Execute fish AI move with a slight delay
        setTimeout(() => this.executeFishMove(), ANIMATION_DELAY.TURN_TRANSITION);
    },
    
    // Select a piece
    selectPiece(piece) {
        // Clear previous selection
        MovesCalculator.clearSelectionAndHighlights();
        
        // Select new piece
        GameState.selectedPiece = piece;
        piece.classList.add('selected');
        
        // Calculate and highlight valid moves
        const moves = MovesCalculator.getValidMoves(piece);
        MovesCalculator.highlightValidMoves(moves);
    },
    
    // Execute the fish AI move
    executeFishMove() {
        // Get all fish that can move
        const movableFish = [];
        GameState.pieces.filter(p => p.id.startsWith('fish')).forEach(fish => {
            const moves = MovesCalculator.getValidMoves(fish);
            if (moves.length > 0) {
                movableFish.push({fish, moves});
            }
        });
        
        // If no fish can move, return to salamander's turn
        if (movableFish.length === 0) {
            console.log("NO FISH CAN MOVE! Passing turn to salamander.");
            alert("Риби не можуть ходити! Хід саламандри.");
            
            // Wait a bit before switching back
            setTimeout(() => this.startSalamanderTurn(), ANIMATION_DELAY.FISH_ANIMATION);
            return;
        }
        
        // Select a random fish that can move
        const randomIndex = Math.floor(Math.random() * movableFish.length);
        const {fish: selectedFish, moves: validMoves} = movableFish[randomIndex];
        
        // Sort moves by proximity to salamander (prefer closer moves)
        const salamander = document.getElementById('salamander');
        const salamanderRow = parseInt(salamander.dataset.row);
        const salamanderCol = parseInt(salamander.dataset.col);
        
        validMoves.sort((a, b) => {
            const [rowA, colA] = a;
            const [rowB, colB] = b;
            
            const distanceA = Math.abs(rowA - salamanderRow) + Math.abs(colA - salamanderCol);
            const distanceB = Math.abs(rowB - salamanderRow) + Math.abs(colB - salamanderCol);
            
            return distanceA - distanceB;
        });
        
        // Highlight the active fish and update message
        const fishNumber = selectedFish.id.split('-')[1] ? parseInt(selectedFish.id.split('-')[1]) + 1 : '';
        console.log(`Fish ${selectedFish.id} is moving!`);
        selectedFish.classList.add('moving-piece');
        
        // Execute the fish move with animation
        setTimeout(() => {
            const [targetRow, targetCol] = validMoves[0];
            
            // Move the fish
            PieceFactory.movePiece(selectedFish, targetRow, targetCol);
            
            // After animation completes
            setTimeout(() => {
                selectedFish.classList.remove('moving-piece');
                
                // Check if salamander is trapped
                if (MovesCalculator.isSalamanderTrapped()) {
                    console.log("Salamander is trapped! Fish win.");
                    this.endGame("Риби перемогли! Саламандру заблоковано!");
                    return;
                }
                
                // Check for win condition
                if (selectedFish.dataset.type === 'salamander' && targetRow === 0) {
                    console.log("Salamander reached the other side! Victory!");
                    this.endGame("Саламандра перемогла, діставшись іншого берега!");
                    return;
                }
                
                // Return to salamander's turn
                setTimeout(() => this.startSalamanderTurn(), ANIMATION_DELAY.TURN_TRANSITION);
            }, ANIMATION_DELAY.FISH_ANIMATION);
        }, ANIMATION_DELAY.FISH_MOVE);
    },
    
    // Handle piece click/touch event
    handlePieceClick(event) {
        if (handlingEvent) return; // Prevent double trigger
        handlingEvent = true;
        setTimeout(() => { handlingEvent = false; }, 300); // Reset flag after a short delay
        
        // Prevent default touch behavior like scrolling, if applicable (passive:true usually handles this)
        // event.preventDefault(); 
        
        // Prevent further processing if game is over
        if (GameState.gameOver) return;
        
        // Stop event propagation (prevent clicking through to square)
        event.stopPropagation();
        
        const clickedPiece = event.currentTarget;
        const pieceType = clickedPiece.dataset.type;
        
        // During fish turn, all pieces are blocked
        if (GameState.currentTurn === 'fish') {
            console.log("Currently fish turn - pieces cannot be selected");
            return;
        }
        
        // Only salamander can be clicked during salamander's turn
        if (pieceType === 'salamander') {
            // If clicking the currently selected piece, deselect it
            if (GameState.selectedPiece === clickedPiece) {
                console.log(`Player deselected ${clickedPiece.id} by tapping it again.`);
                MovesCalculator.clearSelectionAndHighlights();
            } else {
                 console.log(`Player clicked on salamander.`);
                 GameController.selectPiece(clickedPiece);
            }
        } else if (GameState.selectedPiece === clickedPiece) {
             // This case is now handled above for the salamander
             // If another piece type were selectable, this might be needed.
             // console.log(`Player deselected ${GameState.selectedPiece.id}`);
             // MovesCalculator.clearSelectionAndHighlights(); 
        } else {
            console.log(`Cannot select ${pieceType}. It's salamander's turn.`);
        }
    },
    
    // Handle square click/touch event
    handleSquareClick(event) {
        if (handlingEvent) return; // Prevent double trigger
        handlingEvent = true;
        setTimeout(() => { handlingEvent = false; }, 300); // Reset flag after a short delay
        
        // Prevent default touch behavior like scrolling, if applicable (passive:true usually handles this)
        // event.preventDefault();
        
        // Prevent further processing if game is over or not salamander's turn
        if (GameState.gameOver || GameState.currentTurn !== 'salamander') return;
        
        const clickedSquare = event.currentTarget;
        const targetRow = parseInt(clickedSquare.dataset.row);
        const targetCol = parseInt(clickedSquare.dataset.col);
        
        // Process click only if a piece is selected
        if (!GameState.selectedPiece) return;
        
        // Check if clicked square is a valid move
        const isValidMove = GameState.validMoveSquares.includes(clickedSquare);
        
        if (isValidMove) {
            const piece = GameState.selectedPiece;
            
            // Move the piece
            if (PieceFactory.movePiece(piece, targetRow, targetCol)) {
                // Clear selection and highlights
                MovesCalculator.clearSelectionAndHighlights();
                
                // Check for win condition
                if (piece.dataset.type === 'salamander' && targetRow === 0) {
                    this.endGame("Саламандра перемогла, діставшись іншого берега!");
                    return;
                }
                
                // Switch to fish turn
                this.startFishTurn();
            }
        }
    },
    
    // End the game
    endGame(message) {
        GameState.gameOver = true;
        MovesCalculator.clearSelectionAndHighlights();
        console.log(`--- Game Over: ${message} ---`);
        
        // Display the appropriate window based on the message
        setTimeout(() => {
            if (message.includes("Саламандра перемогла")) {
                document.getElementById('victory-window').style.display = 'block';
            } else {
                document.getElementById('defeat-window').style.display = 'block';
            }
        }, 100); // Short delay so board updates visually first
    },
    
    // Hide game over windows
    hideGameOverWindows() {
        document.getElementById('victory-window').style.display = 'none';
        document.getElementById('defeat-window').style.display = 'none';
    }
};

// Initialize the game
GameController.init(); 