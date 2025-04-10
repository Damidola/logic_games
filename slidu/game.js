class Game {
    constructor() {
        this.board = Array(8).fill().map(() => Array(8).fill(null));
        this.traces = [];
        this.currentPlayer = 'white';
        this.gameOver = false;
        this.isComputerTurn = false;
        
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

                if (this.board[row][col]) {
                    const piece = document.createElement('div');
                    piece.className = 'piece';
                    piece.textContent = '♜';
                    piece.style.color = this.board[row][col].color === 'white' ? '#fff' : '#000';
                    square.appendChild(piece);
                }

                // Check for trace and apply specific class
                const traceColor = this.getTraceColor(row, col);
                if (traceColor) {
                    const traceCircle = document.createElement('div');
                    traceCircle.className = `trace-circle ${traceColor}`;
                    square.appendChild(traceCircle);
                }

                square.addEventListener('click', () => this.handleSquareClick(row, col));
                chessboard.appendChild(square);
            }
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
        if (this.gameOver || this.isComputerTurn) return;

        const piece = this.board[row][col];
        
        if (piece && piece.color === this.currentPlayer) {
            this.showValidMoves(row, col);
        } else if (this.selectedPiece) {
            const fromRow = this.selectedPiece.row;
            const fromCol = this.selectedPiece.col;
            
            if (this.isValidMove(fromRow, fromCol, row, col)) {
                this.makeMove(fromRow, fromCol, row, col);
                // Only trigger computer move if the game is NOT over after the player's move
                if (!this.gameOver) {
                    this.isComputerTurn = true;
                    // Check if computer has moves BEFORE delaying
                    if (this.hasValidMoves()) {
                        setTimeout(() => this.computerMove(), 500); // Slightly faster AI turn
                    } else {
                        // If computer has no moves immediately after player's turn, player wins
                        this.gameOver = true;
                        const winnerText = 'Білі'; // Player (White) wins
                        document.getElementById('game-status').textContent = `Гра закінчена! Перемогли ${winnerText}!`;
                        this.isComputerTurn = false; // Stop computer turn attempt
                    }
                }
            }
        }
    }

    showValidMoves(row, col) {
        this.selectedPiece = { row, col };
        this.clearHighlights();
        
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
        const movedPiece = this.board[fromRow][fromCol];
        if (!movedPiece) {
            console.error("Trying to move a non-existent piece!", fromRow, fromCol);
            return; // Abort the move
        }

        // 1. Add trace at the STARTING position
        this.traces.push({ 
            row: fromRow, 
            col: fromCol, 
            color: movedPiece.color 
        });

        // 2. Capture opponent's trace if landing on one
        const destTraceColor = this.getTraceColor(toRow, toCol);
        if (destTraceColor && destTraceColor !== movedPiece.color) {
            this.traces = this.traces.filter(trace => 
                !(trace.row === toRow && trace.col === toCol)
            );
        }

        // 3. Move the piece on the board
        this.board[toRow][toCol] = movedPiece;
        this.board[fromRow][fromCol] = null;

        // 4. Update the rook's tracked position
        if (movedPiece.color === 'white') {
            this.whiteRookPos = { row: toRow, col: toCol };
        } else {
            this.blackRookPos = { row: toRow, col: toCol };
        }
        
        // VERIFY: Check that rook was correctly moved
        if (!this.board[toRow][toCol]) {
            console.error("ROOK DISAPPEARED DURING MOVE!", { from: {row: fromRow, col: fromCol}, to: {row: toRow, col: toCol}, piece: movedPiece });
            // RECOVERY: Place the rook back at the destination
            this.board[toRow][toCol] = movedPiece;
        }

        // Check if the last move put the opponent's rook in danger (for display purposes only)
        const opponentRookPos = movedPiece.color === 'white' ? this.blackRookPos : this.whiteRookPos;
        
        // VERIFY: Ensure opponent rook exists
        if (!this.board[opponentRookPos.row][opponentRookPos.col]) {
            console.error("OPPONENT ROOK MISSING AFTER MOVE!", opponentRookPos);
            // RECOVERY: Restore the opponent's rook
            const opponentColor = movedPiece.color === 'white' ? 'black' : 'white';
            this.board[opponentRookPos.row][opponentRookPos.col] = { type: 'rook', color: opponentColor };
        }
        
        const isUnderAttack = this.isRookUnderAttack(opponentRookPos.row, opponentRookPos.col, movedPiece.color === 'white' ? 'black' : 'white');
        if (isUnderAttack) {
            // For visualization or notification purposes, not ending the game
            const attackedPlayer = movedPiece.color === 'white' ? 'Чорні' : 'Білі';
            document.getElementById('game-status').textContent = `${attackedPlayer} під атакою!`;
        } else {
            document.getElementById('game-status').textContent = '';
        }

        // 5. Switch player
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';

        // 6. Verify both rooks exist before checking valid moves
        this.verifyRooksExist();
        
        // 7. Check if the NEW current player has any valid moves
        if (!this.hasValidMoves()) {
            this.gameOver = true;
            // The winner is the player whose turn it WASN'T (the one who just moved)
            const winnerText = this.currentPlayer === 'white' ? 'Чорні' : 'Білі'; 
            document.getElementById('game-status').textContent = `Гра закінчена! Перемогли ${winnerText}!`;
            // Do NOT remove the losing piece, just end the game
        }

        // 8. Update UI
        this.clearHighlights();
        this.selectedPiece = null;
        this.renderBoard(); // Render board AFTER checking game over
        this.updateGameInfo();
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
        // Computer only moves if it's its turn and game is not over
        if (this.gameOver || !this.isComputerTurn || this.currentPlayer !== 'black') {
            this.isComputerTurn = false; // Ensure flag is reset if called incorrectly
            return;
        }

        // VERIFY: Ensure black rook exists before attempting to move it
        if (!this.board[this.blackRookPos.row][this.blackRookPos.col]) {
            console.error("BLACK ROOK MISSING BEFORE COMPUTER MOVE!", this.blackRookPos);
            // RECOVERY: Restore the black rook if it's missing
            this.board[this.blackRookPos.row][this.blackRookPos.col] = { type: 'rook', color: 'black' };
        }

        const currentRookPos = this.blackRookPos;
        const fromRow = currentRookPos.row;
        const fromCol = currentRookPos.col;
        const validMoves = [];

        for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
                if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
                    validMoves.push({ row: toRow, col: toCol });
                }
            }
        }

        if (validMoves.length > 0) {
            const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            this.makeMove(fromRow, fromCol, randomMove.row, randomMove.col);
            
            // VERIFY: Check that black rook is still on the board after computer's move
            if (!this.board[this.blackRookPos.row][this.blackRookPos.col]) {
                console.error("BLACK ROOK DISAPPEARED AFTER COMPUTER MOVE!", this.blackRookPos);
                // RECOVERY: Restore the black rook if it disappeared
                this.board[this.blackRookPos.row][this.blackRookPos.col] = { type: 'rook', color: 'black' };
                this.renderBoard(); // Re-render to show the restored rook
            }
            
            // Check if the HUMAN player has moves after computer's move
            if (!this.gameOver && !this.hasValidMoves()) {
                 this.gameOver = true;
                 const winnerText = 'Чорні'; // Computer (Black) wins
                 document.getElementById('game-status').textContent = `Гра закінчена! Перемогли ${winnerText}!`;
            }
        } else {
            // This case SHOULD be caught before calling computerMove, 
            // but if it happens, it means the player won on their previous turn.
            // The gameOver flag should already be set by makeMove.
            console.error("Computer has no valid moves, but game wasn't flagged as over?");
        }

        this.isComputerTurn = false; // Player's turn now
    }

    updateGameInfo() {
        const playerText = this.currentPlayer === 'white' ? 'Білі' : 'Чорні';
        document.getElementById('current-player').textContent = 
            `Поточний гравець: ${playerText}`;
        
        // VERIFY: Ensure both rooks exist on the board
        this.verifyRooksExist();
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
        // Simply create a new Game instance, replacing the old one
        new Game();
    }
}

// Keep a reference to the current game instance if needed outside, otherwise not necessary
let currentGame;

window.addEventListener('load', () => {
    currentGame = new Game();
}); 