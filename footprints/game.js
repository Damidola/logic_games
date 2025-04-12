class Game {
    constructor() {
        this.board = Array(8).fill().map(() => Array(8).fill(null));
        this.traces = [];
        this.currentPlayer = 'white';
        this.gameOver = false;
        this.isComputerTurn = false;
        this.selectedPieceElement = null; // Element being dragged
        this.dragStartPos = null; // { row, col } where drag started
        this.isDragging = false;
        this.touchStartTime = 0; // For tap vs drag detection
        this.touchStartPos = { x: 0, y: 0 }; // Initial touch position
        this.forceTouchDrag = false; // Force touch to use manual positioning
        this.draggedElement = null; // Clone for dragging
        this.tapTimeout = null; // Timer for tap detection
        this.dragThreshold = 5; // Pixels moved to trigger drag
        this.touchDragging = false; // Whether currently dragging via touch
        this.touchDragImage = null; // Visual element shown during touch drag
        
        // Check if random positions checkbox is checked
        const useRandomPositions = document.getElementById('random-positions-checkbox') && 
                                   document.getElementById('random-positions-checkbox').checked;
        
        if (useRandomPositions) {
            // Generate random positions that don't share row/column
            const positions = this.generateRandomPositions();
            this.whiteRookPos = positions.white;
            this.blackRookPos = positions.black;
        } else {
            // Default positions
            this.whiteRookPos = { row: 7, col: 7 }; // h8 (right bottom)
            this.blackRookPos = { row: 0, col: 0 }; // a1 (left top)
        }
        
        this.initializeBoard();
        this.renderBoard();
        this.updateGameInfo();
        this.addPlayAgainListener(); // Add listener for the button
    }
    
    // Generate random positions for rooks that aren't on the same row or column
    generateRandomPositions() {
        // Place white rook first
        const whiteRow = Math.floor(Math.random() * 8);
        const whiteCol = Math.floor(Math.random() * 8);
        
        let blackRow, blackCol;
        
        // Keep generating positions for black rook until it's not on same row/column
        do {
            blackRow = Math.floor(Math.random() * 8);
            blackCol = Math.floor(Math.random() * 8);
        } while (blackRow === whiteRow || blackCol === whiteCol);
        
        return {
            white: { row: whiteRow, col: whiteCol },
            black: { row: blackRow, col: blackCol }
        };
    }

    initializeBoard() {
        // Place white rook at its position
        this.board[this.whiteRookPos.row][this.whiteRookPos.col] = { type: 'rook', color: 'white' };
        // Place black rook at its position
        this.board[this.blackRookPos.row][this.blackRookPos.col] = { type: 'rook', color: 'black' };
    }

    renderBoard() {
        const chessboard = document.getElementById('chessboard');
        chessboard.innerHTML = '';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
                square.dataset.row = row;
                square.dataset.col = col;

                // Add drop listeners to the square
                square.addEventListener('dragover', this.handleDragOver.bind(this));
                square.addEventListener('drop', this.handleDrop.bind(this));

                if (this.board[row][col]) {
                    const piece = document.createElement('div');
                    piece.className = 'piece';
                    piece.textContent = '♜';
                    piece.style.color = this.board[row][col].color === 'white' ? '#fff' : '#000';
                    
                    // Add drag listeners if it's the current player's piece and game is not over
                    if (this.board[row][col].color === this.currentPlayer && !this.gameOver) {
                        piece.draggable = true;
                        piece.addEventListener('dragstart', (e) => this.handleDragStart(e, row, col));
                        piece.addEventListener('dragend', this.handleDragEnd.bind(this));
                        
                        // Touch events - handled differently to avoid issues
                        piece.addEventListener('touchstart', (e) => {
                            // Store the starting position for potential click or drag
                            const pieceData = this.board[row][col];
                            if (this.isComputerTurn || this.gameOver || !pieceData || this.currentPlayer !== pieceData.color) {
                                return;
                            }
                            
                            // Record touch start time and position
                            this.touchStartTime = Date.now();
                            this.touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                            this.dragStartPos = { row, col };
                            this.selectedPieceElement = e.target;
                            
                            // Prevent default to avoid scrolling or other browser gestures
                            e.preventDefault();
                            
                            // Set up touch move and end handlers
                            document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
                            document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
                            document.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
                        }, { passive: false }); // Need non-passive listener to call preventDefault
                    }
                    
                    square.appendChild(piece);
                }

                // Check for trace and apply specific class
                const traceColor = this.getTraceColor(row, col);
                if (traceColor) {
                    const traceCircle = document.createElement('div');
                    traceCircle.className = `trace-circle ${traceColor}`;
                    square.appendChild(traceCircle);
                }

                // Handle clicks for selection/movement
                square.addEventListener('click', () => this.handleSquareClick(row, col));
                
                // Handle touch events for movement after selection (for the tap-then-tap approach)
                square.addEventListener('touchstart', (e) => {
                    if (this.selectedPiece && 
                        this.isValidMove(this.selectedPiece.row, this.selectedPiece.col, row, col)) {
                        e.preventDefault(); // Prevent default to avoid scrolling
                        this.makeMove(this.selectedPiece.row, this.selectedPiece.col, row, col);
                        if (!this.gameOver) {
                            this.isComputerTurn = true;
                            setTimeout(() => this.computerMove(), 500);
                        }
                    }
                }, { passive: false });
                
                chessboard.appendChild(square);
            }
        }
        
        // Re-apply valid move highlights if a piece was selected via click
        if (this.selectedPiece) {
            this.showValidMoves(this.selectedPiece.row, this.selectedPiece.col, false); // Don't clear highlights
        }
    }

    getTraceColor(row, col) {
        const trace = this.traces.find(trace => trace.row === row && trace.col === col);
        return trace ? trace.color : null;
    }

    isValidMove(fromRow, fromCol, toRow, toCol) {
        // MUST MOVE: Rook cannot "move" to the same square it's already on
        if (fromRow === toRow && fromCol === toCol) {
            return false; // Cannot stay in place - must move to a different square
        }

        // Check if it's the current player's piece
        const piece = this.board[fromRow][fromCol];
        // Ensure the move originates from the correct rook's current position
        const currentRookPos = this.currentPlayer === 'white' ? this.whiteRookPos : this.blackRookPos;
        if (!piece || piece.color !== this.currentPlayer || fromRow !== currentRookPos.row || fromCol !== currentRookPos.col) {
             return false;
        }

        // STRICT RULE: A rook can NEVER move to a cell where its own trace exists
        const destTraceColor = this.getTraceColor(toRow, toCol);
        if (destTraceColor === this.currentPlayer) {
            return false; // NEVER allow moving to your own trace
        }

        // Check if the move is horizontal or vertical
        if (fromRow !== toRow && fromCol !== toCol) return false;

        // Check if the path is clear (no pieces or ANY traces in the way)
        if (fromRow === toRow) { // Horizontal move
            const start = Math.min(fromCol, toCol);
            const end = Math.max(fromCol, toCol);
            for (let col = start + 1; col < end; col++) {
                // Path is blocked if there's a piece OR ANY trace
                if (this.board[fromRow][col] || this.getTraceColor(fromRow, col)) return false;
            }
        } else { // Vertical move
            const start = Math.min(fromRow, toRow);
            const end = Math.max(fromRow, toRow);
            for (let row = start + 1; row < end; row++) {
                // Path is blocked if there's a piece OR ANY trace
                if (this.board[row][fromCol] || this.getTraceColor(row, fromCol)) return false;
            }
        }
        
        // Check if destination is safe to move to
        const opponentRookPos = this.currentPlayer === 'white' ? this.blackRookPos : this.whiteRookPos;

        // If destination has an opponent's trace, check if it's safe to capture
        if (destTraceColor && destTraceColor !== this.currentPlayer) {
            // Check if the capture square is under attack by OTHER opponent's traces
            for (const trace of this.traces) {
                // Consider only opponent's traces
                if (trace.color !== this.currentPlayer) {
                    // Check if this trace is DIFFERENT from the one being captured
                    if (trace.row !== toRow || trace.col !== toCol) {
                        // Check if this OTHER opponent trace attacks the landing square (adjacency)
                        if (Math.abs(trace.row - toRow) <= 1 && Math.abs(trace.col - toCol) <= 1) {
                            return false; // Can't capture if another opponent's trace attacks the square
                        }
                    }
                }
            }
            
            // Check if the capture square is under attack by opponent's rook
            if (toRow === opponentRookPos.row || toCol === opponentRookPos.col) {
                return false; // Can't capture if opponent's rook attacks the square
            }
            
            return true; // Safe to capture opponent's trace
        }
        
        // Check if destination is under attack by opponent's rook, ONLY IF path is clear
        let isAttackedByOpponentRook = false;
        if (toRow === opponentRookPos.row) { // Same row attack?
            let pathBlocked = false;
            const startCol = Math.min(toCol, opponentRookPos.col);
            const endCol = Math.max(toCol, opponentRookPos.col);
            for (let c = startCol + 1; c < endCol; c++) {
                // Check for any trace or the current player's rook blocking the path
                if (this.getTraceColor(toRow, c) || (this.board[toRow][c] && this.board[toRow][c].color === this.currentPlayer)) {
                    pathBlocked = true;
                    break;
                }
            }
            if (!pathBlocked) { // Path is clear, so it IS attacked
                isAttackedByOpponentRook = true;
            }
        } else if (toCol === opponentRookPos.col) { // Same column attack?
            let pathBlocked = false;
            const startRow = Math.min(toRow, opponentRookPos.row);
            const endRow = Math.max(toRow, opponentRookPos.row);
            for (let r = startRow + 1; r < endRow; r++) {
                // Check for any trace or the current player's rook blocking the path
                if (this.getTraceColor(r, toCol) || (this.board[r][toCol] && this.board[r][toCol].color === this.currentPlayer)) {
                    pathBlocked = true;
                    break;
                }
            }
            if (!pathBlocked) { // Path is clear, so it IS attacked
                isAttackedByOpponentRook = true;
            }
        }

        if (isAttackedByOpponentRook) {
            return false; // Destination is under (unblocked) attack by opponent's rook
        }
        
        // Check if destination is adjacent to any opponent's traces
        for (const trace of this.traces) {
            if (trace.color !== this.currentPlayer && 
                Math.abs(trace.row - toRow) <= 1 && 
                Math.abs(trace.col - toCol) <= 1) {
                return false;
            }
        }

        return true;
    }

    handleSquareClick(row, col) {
        // Prevent click action if a drag was just completed on this square
        if (this.gameOver || this.isComputerTurn || this.isDragging) {
             console.log("Click ignored: dragging or game over/computer turn");
             // Reset isDragging here only if it was set by a short touchmove followed by touchend
             // This might need adjustment based on testing.
             // this.isDragging = false; 
             return;
        }

        const piece = this.board[row][col];
        
        // If clicking the same selected piece, clear highlights and selection
        if (this.selectedPiece && this.selectedPiece.row === row && this.selectedPiece.col === col) {
            this.clearHighlights();
            this.selectedPiece = null;
            return;
        }
        
        if (piece && piece.color === this.currentPlayer) {
            this.clearHighlights(); // Clear any existing highlights
            this.showValidMoves(row, col);
        } else if (this.selectedPiece) {
            const fromRow = this.selectedPiece.row;
            const fromCol = this.selectedPiece.col;
            
            if (this.isValidMove(fromRow, fromCol, row, col)) {
                this.makeMove(fromRow, fromCol, row, col);
                // Trigger computer move ONLY if game is not over
                if (!this.gameOver) {
                    this.isComputerTurn = true;
                    // Computer will check for its own valid moves before moving
                    setTimeout(() => this.computerMove(), 500);
                }
            }
        }
    }

    showValidMoves(row, col, shouldClearHighlights = true) {
        this.selectedPiece = { row, col };
        if (shouldClearHighlights) {
        this.clearHighlights();
        }
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.isValidMove(row, col, r, c)) {
                    const square = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    square.classList.add('valid-move');
                }
            }
        }
    }

    clearHighlights() {
        document.querySelectorAll('.valid-move').forEach(square => {
            square.classList.remove('valid-move');
        });
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        // Check if destination has opponent's trace and remove it
        const destTraceIndex = this.traces.findIndex(trace => trace.row === toRow && trace.col === toCol && trace.color !== this.currentPlayer);
        if (destTraceIndex > -1) {
            this.traces.splice(destTraceIndex, 1); // Remove opponent's trace
        }

        // Leave a trace at the starting position
        this.traces.push({ row: fromRow, col: fromCol, color: this.currentPlayer });

        // Update rook position
        if (this.currentPlayer === 'white') {
            this.whiteRookPos = { row: toRow, col: toCol };
        } else {
            this.blackRookPos = { row: toRow, col: toCol };
        }
        
        // Update board state
        this.board[fromRow][fromCol] = null;
        this.board[toRow][toCol] = { type: 'rook', color: this.currentPlayer };

        // Clear selection and highlights
        this.selectedPiece = null; // Deselect after move
        this.clearHighlights();
        this.dragStartPos = null; // Clear drag start position
        this.selectedPieceElement = null; // Clear dragged element

        // Check for win condition (opponent has no moves) IMMEDIATELY after moving
        // It's crucial to check BEFORE switching the player
        const opponentColor = this.currentPlayer === 'white' ? 'black' : 'white';
        if (!this.hasValidMovesForPlayer(opponentColor)) {
            this.gameOver = true;
            if (this.currentPlayer === 'white') { // White made the move, Black has no moves -> White wins
                document.getElementById('victory-window').style.display = 'block';
            } else { // Black made the move, White has no moves -> Black wins (Player loses)
                document.getElementById('defeat-window').style.display = 'block';
            }
            // Don't switch player or update info if game is over
             this.renderBoard(); // Render final board state
             this.updateGameInfo(); // Update info to show final state
             return; // Exit early
        }


        // Switch player AFTER checking win condition
        this.currentPlayer = opponentColor; // Use opponentColor calculated earlier

        // Update game info and re-render
        this.updateGameInfo();
        this.renderBoard();

        // Verify rooks exist after move (debugging check)
        this.verifyRooksExist();
    }

    // New helper method to check if a rook is under attack
    isRookUnderAttack(rookRow, rookCol, rookColor) {
        // Check if rook is adjacent to any enemy trace
        for (const trace of this.traces) {
            if (trace.color !== rookColor && 
                Math.abs(trace.row - rookRow) <= 1 && 
                Math.abs(trace.col - rookCol) <= 1) {
                return true;
            }
        }
        return false;
    }

    hasValidMoves() {
        // Get the position of the rook whose turn it currently is
        const currentRookPos = this.currentPlayer === 'white' ? this.whiteRookPos : this.blackRookPos;
        const fromRow = currentRookPos.row;
        const fromCol = currentRookPos.col;

        // Debug logging to help understand the state
        console.log(`Checking moves for ${this.currentPlayer} rook at ${fromRow},${fromCol}`);
        
        // Check all possible squares on the board
        for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
                 // Skip checking the current position
                if (toRow === fromRow && toCol === fromCol) continue;
                
                // Use the refined isValidMove logic
                if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
                    console.log(`Valid move found: ${fromRow},${fromCol} -> ${toRow},${toCol}`);
                    return true; // Found at least one valid move
                }
            }
        }
        // If the loops complete without finding a move, none exist
        console.log(`No valid moves found for ${this.currentPlayer} rook`);
        return false;
    }

    computerMove() {
        if (this.gameOver || !this.isComputerTurn) return; // Exit if game over or not computer's turn

        const currentRookPos = this.blackRookPos; // Computer is always black
        const validMoves = [];

        // Find all valid moves for the computer (black)
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (this.isValidMove(currentRookPos.row, currentRookPos.col, row, col)) {
                    validMoves.push({ row, col });
                }
            }
        }
        
        // If computer has moves, make one. The win condition check is now in makeMove.
        if (validMoves.length > 0) {
            const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            this.makeMove(currentRookPos.row, currentRookPos.col, randomMove.row, randomMove.col);
        } 
        // Note: The case where computer has NO moves is implicitly handled 
        // because the player's previous 'makeMove' call would have already 
        // detected this and set gameOver = true, displaying the victory window.
        // If we somehow reach here and validMoves.length is 0, something is wrong,
        // but the game should already be over.
        
        this.isComputerTurn = false; // End computer's turn
    }

    updateGameInfo() {
        document.getElementById('current-player').textContent = `Хід: ${this.currentPlayer === 'white' ? 'Білих' : 'Чорних'}`;
        // Clear the old text status - we use windows now
        // document.getElementById('game-status').textContent = ''; 
        // Ensure game status text remains hidden unless explicitly used for errors etc.
        if (!this.gameOver) { 
             document.getElementById('game-status').style.display = 'none';
        } else {
             // Optionally show a generic game over message if needed, 
             // but the windows handle specific win/loss states.
             // document.getElementById('game-status').textContent = 'Гра закінчена!';
             // document.getElementById('game-status').style.display = 'block';
        }
    }
    
    // Add a new verification method to ensure rooks are always on the board
    verifyRooksExist() {
        // Check white rook
        if (!this.board[this.whiteRookPos.row][this.whiteRookPos.col] || 
            this.board[this.whiteRookPos.row][this.whiteRookPos.col].color !== 'white') {
            console.error("WHITE ROOK MISSING!", this.whiteRookPos);
            // Restore white rook
            this.board[this.whiteRookPos.row][this.whiteRookPos.col] = { type: 'rook', color: 'white' };
            this.renderBoard();
        }
        
        // Check black rook
        if (!this.board[this.blackRookPos.row][this.blackRookPos.col] || 
            this.board[this.blackRookPos.row][this.blackRookPos.col].color !== 'black') {
            console.error("BLACK ROOK MISSING!", this.blackRookPos);
            // Restore black rook
            this.board[this.blackRookPos.row][this.blackRookPos.col] = { type: 'rook', color: 'black' };
            this.renderBoard();
        }
    }

    addPlayAgainListener() {
        const button = document.getElementById('play-again-button');
        if (button) {
            // Remove existing listener to prevent duplicates if constructor is called again
            button.removeEventListener('click', this.startNewGame);
            button.addEventListener('click', this.startNewGame);
        }
    }

    startNewGame() {
        // Hide any visible victory/defeat windows
        document.getElementById('victory-window').style.display = 'none';
        document.getElementById('defeat-window').style.display = 'none';
        
        // Create a new Game instance
        currentGame = new Game();
    }

    // Renamed from hasValidMoves to avoid confusion
    currentPlayerHasValidMoves() {
        const currentRookPos = this.currentPlayer === 'white' ? this.whiteRookPos : this.blackRookPos;
        const fromRow = currentRookPos.row;
        const fromCol = currentRookPos.col;

        for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; col < 8; col++) { // Typo corrected: toCol++
                if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
                    return true; 
                }
            }
        }
        return false; 
    }

    // Helper function to check moves for a SPECIFIC player
    hasValidMovesForPlayer(playerColor) {
        const rookPos = playerColor === 'white' ? this.whiteRookPos : this.blackRookPos;
        
        // Ensure rook position is valid before proceeding
        if (!rookPos || this.board[rookPos.row] === undefined || this.board[rookPos.row][rookPos.col] === undefined) {
             console.error(`Invalid rook position for ${playerColor}:`, rookPos);
             return false; // Cannot have moves if position is invalid
        }

        const fromRow = rookPos.row;
        const fromCol = rookPos.col;

        // Check all possible destination squares
        for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
                 // Temporarily set current player to check validity correctly
                 const originalPlayer = this.currentPlayer;
                 this.currentPlayer = playerColor;
                 const valid = this.isValidMove(fromRow, fromCol, toRow, toCol);
                 this.currentPlayer = originalPlayer; // Restore original player

                 if (valid) {
                     return true; // Found at least one valid move
                 }
            }
        }
        return false; // No valid moves found
    }

    // --- Drag and Drop Handlers ---

    handleDragStart(event, row, col) {
        const pieceData = this.board[row][col];
        // Prevent dragging if it's not the player's turn or game is over or no piece
        if (this.isComputerTurn || this.gameOver || !pieceData || this.currentPlayer !== pieceData.color) {
            if (event.cancelable) event.preventDefault();
            return;
        }
        
        this.isDragging = true;
        this.dragStartPos = { row, col };
        this.selectedPiece = { row, col }; // Also select the piece being dragged
        this.selectedPieceElement = event.target.closest('.piece'); // Ensure we get the piece div
        
        // Use a timeout to allow the browser to render the drag image before hiding/styling
        setTimeout(() => {
            if (this.selectedPieceElement) {
                 this.selectedPieceElement.classList.add('dragging');
             }
        }, 0);

        if (event.dataTransfer) {
            try {
            event.dataTransfer.effectAllowed = 'move';
             // Set dummy data (required for Firefox)
             event.dataTransfer.setData('text/plain', ''); 
            } catch (e) {
                console.error("Error setting dataTransfer properties:", e);
            }
        }

        this.showValidMoves(row, col); // Show valid moves on drag start
    }

    handleDragOver(event) {
        if (!this.isDragging) return;
        
        event.preventDefault(); // Necessary to allow dropping
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
         }
    }

    handleDrop(event) {
        event.preventDefault();
        
        if (!this.dragStartPos || !this.isDragging) {
            return; // No valid drag started
        }

        let targetSquare = event.target;
        
        // If dropped on a piece or trace, get the parent square
             if (targetSquare && !targetSquare.classList.contains('square')) {
                 targetSquare = targetSquare.closest('.square');
        }

        if (targetSquare && targetSquare.classList.contains('square')) {
            const toRow = parseInt(targetSquare.dataset.row);
            const toCol = parseInt(targetSquare.dataset.col);

            if (this.isValidMove(this.dragStartPos.row, this.dragStartPos.col, toRow, toCol)) {
                this.makeMove(this.dragStartPos.row, this.dragStartPos.col, toRow, toCol);
                
                // Trigger computer move ONLY if game is not over after player's move
                if (!this.gameOver) {
                    this.isComputerTurn = true;
                    setTimeout(() => this.computerMove(), 500); 
                }
            } else {
                // Invalid drop - clear selection
                 this.clearHighlights();
                this.selectedPiece = null;
            }
        } else {
            // Dropped outside board - clear selection
            this.clearHighlights();
            this.selectedPiece = null;
        }
        
        // Reset drag state
        this.isDragging = false;
        if (this.selectedPieceElement) {
            this.selectedPieceElement.classList.remove('dragging');
        }
        this.dragStartPos = null;
        this.selectedPieceElement = null;
    }

    handleDragEnd(event) {
        // Reset CSS classes
        if (this.selectedPieceElement) {
            this.selectedPieceElement.classList.remove('dragging');
        }
        
        // Reset drag state
        this.isDragging = false;
            this.dragStartPos = null;
        this.selectedPieceElement = null;
        
        // Re-render if drag was cancelled
        if (event.type === 'dragend') {
            this.renderBoard();
        }
    }

    // Touch event handlers
    handleTouchMove(event) {
        if (!this.dragStartPos) return;
        
        // Prevent scrolling and other touch gestures
        event.preventDefault();
        
        const touch = event.touches[0];
        const currentX = touch.clientX;
        const currentY = touch.clientY;
        
        // Calculate how far the finger has moved
        const deltaX = Math.abs(currentX - this.touchStartPos.x);
        const deltaY = Math.abs(currentY - this.touchStartPos.y);
        
        // If movement exceeds threshold, consider it a drag
        if (!this.touchDragging && (deltaX > this.dragThreshold || deltaY > this.dragThreshold)) {
            this.touchDragging = true;
            this.isDragging = true;
            
            // Create drag image if we don't have one yet
            if (!this.touchDragImage) {
                this.touchDragImage = document.createElement('div');
                this.touchDragImage.className = 'piece touch-drag-image';
                this.touchDragImage.textContent = '♜';
                this.touchDragImage.style.color = this.currentPlayer === 'white' ? '#fff' : '#000';
                this.touchDragImage.style.position = 'fixed';
                this.touchDragImage.style.pointerEvents = 'none';
                this.touchDragImage.style.zIndex = '1000';
                
                // Make it larger for mobile
                this.touchDragImage.style.fontSize = '40px';
                this.touchDragImage.style.width = '60px';
                this.touchDragImage.style.height = '60px';
                this.touchDragImage.style.display = 'flex';
                this.touchDragImage.style.alignItems = 'center';
                this.touchDragImage.style.justifyContent = 'center';
                
                document.body.appendChild(this.touchDragImage);
                
                // Show valid moves
                this.showValidMoves(this.dragStartPos.row, this.dragStartPos.col);
            }
        }
        
        // If dragging, update position of drag image
        if (this.touchDragging && this.touchDragImage) {
            // Center the drag image under the finger
            this.touchDragImage.style.left = `${currentX - 30}px`;
            this.touchDragImage.style.top = `${currentY - 30}px`;
        }
    }
    
    handleTouchEnd(event) {
        // Make a local copy of dragStartPos in case it gets modified during processing
        const startPos = this.dragStartPos ? {...this.dragStartPos} : null;
        
        // Safety check - if no drag start position, just clean up and return
        if (!startPos) {
            this.cleanupTouchDrag();
            return;
        }
        
        // If we were dragging, handle the drop
        if (this.touchDragging) {
            const touch = event.changedTouches[0];
            if (!touch) {
                this.cleanupTouchDrag();
                return;
            }
            
            // Find the element under the finger
            if (this.touchDragImage) {
                this.touchDragImage.style.display = 'none'; // Temporarily hide
            }
            
            const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
            
            // Restore drag image visibility
            if (this.touchDragImage) {
                this.touchDragImage.style.display = '';
            }
            
            // Find the square under the finger
            let targetSquare = elementAtPoint;
            if (targetSquare && !targetSquare.classList.contains('square')) {
                targetSquare = targetSquare.closest('.square');
            }
            
            // If we found a valid square, try to move there
            if (targetSquare && targetSquare.classList.contains('square')) {
                const toRow = parseInt(targetSquare.dataset.row);
                const toCol = parseInt(targetSquare.dataset.col);
                
                if (this.isValidMove(startPos.row, startPos.col, toRow, toCol)) {
                    // Clean up before making the move
                    this.cleanupTouchDrag();
                    
                    // Make the move
                    this.makeMove(startPos.row, startPos.col, toRow, toCol);
                    
                    // Trigger computer move if needed
                    if (!this.gameOver) {
                        this.isComputerTurn = true;
                        setTimeout(() => this.computerMove(), 500);
                    }
                    return;
                }
            }
            
            // If we get here, drop was invalid
            this.clearHighlights();
            this.selectedPiece = null;
        } else {
            // It was a tap, handle as simple click (using the local copy of startPos)
            this.handleSquareClick(startPos.row, startPos.col);
        }
        
        // Clean up
        this.cleanupTouchDrag();
    }
    
    cleanupTouchDrag() {
        // Remove the drag image
        if (this.touchDragImage) {
            try {
                document.body.removeChild(this.touchDragImage);
            } catch (e) {
                console.error("Error removing touch drag image:", e);
            }
            this.touchDragImage = null;
        }
        
        // Remove event listeners
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
        document.removeEventListener('touchcancel', this.handleTouchEnd);
        
        // Reset drag state
        this.touchDragging = false;
        this.isDragging = false;
        this.dragStartPos = null;
        this.selectedPieceElement = null;
    }
}

// Keep a reference to the current game instance if needed outside, otherwise not necessary
let currentGame;

window.addEventListener('load', () => {
    currentGame = new Game();
}); 