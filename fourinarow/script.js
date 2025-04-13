document.addEventListener('DOMContentLoaded', () => {
    const gameBoard = document.getElementById('game-board');
    const statusDisplay = document.getElementById('status');
    const restartButton = document.getElementById('restart-btn');
    
    const ROWS = 6;
    const COLS = 7;
    const PLAYER = 'player';
    const AI = 'ai';
    const EMPTY = null;
    const WIN_LENGTH = 4;
    
    let board = [];
    let gameActive = true;
    let currentPlayer = PLAYER;
    
    // Initialize the game
    initGame();
    
    // Event listeners
    restartButton.addEventListener('click', initGame);
    
    function initGame() {
        board = Array(ROWS).fill().map(() => Array(COLS).fill(EMPTY));
        gameActive = true;
        currentPlayer = PLAYER;
        statusDisplay.textContent = 'Your turn! Click a column to drop a disc.';
        
        // Clear the game board
        gameBoard.innerHTML = '';
        
        // Create the columns and cells
        for (let col = 0; col < COLS; col++) {
            const column = document.createElement('div');
            column.classList.add('column');
            column.dataset.col = col;
            
            for (let row = 0; row < ROWS; row++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = ROWS - 1 - row; // Reverse order for visual stacking
                cell.dataset.col = col;
                column.appendChild(cell);
            }
            
            column.addEventListener('click', handleColumnClick);
            gameBoard.appendChild(column);
        }
    }
    
    function handleColumnClick(event) {
        if (!gameActive || currentPlayer === AI) return;
        
        const col = parseInt(event.currentTarget.dataset.col);
        
        // Find the lowest empty row in the selected column
        const row = findLowestEmptyRow(col);
        
        if (row === -1) {
            // Column is full
            return;
        }
        
        makeMove(row, col, PLAYER);
        
        if (gameActive) {
            // AI's turn
            currentPlayer = AI;
            statusDisplay.textContent = 'AI is thinking...';
            
            setTimeout(() => {
                makeAIMove();
                currentPlayer = PLAYER;
                if (gameActive) {
                    statusDisplay.textContent = 'Your turn! Click a column to drop a disc.';
                }
            }, 1000);
        }
    }
    
    function makeMove(row, col, player) {
        // Update board state
        board[row][col] = player;
        
        // Update visual representation
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        cell.classList.add(player, 'animate-drop');
        
        // Check for win or draw
        if (checkWin(row, col, player)) {
            gameActive = false;
            highlightWinningCells();
            statusDisplay.textContent = player === PLAYER ? 'You won!' : 'AI won!';
        } else if (isBoardFull()) {
            gameActive = false;
            statusDisplay.textContent = 'Game ended in a draw!';
        }
    }
    
    function makeAIMove() {
        if (!gameActive) return;
        
        // Simple AI strategy:
        // 1. If AI can win in one move, make that move
        // 2. If player can win in one move, block that move
        // 3. Otherwise, make a strategic move
        
        // Check if AI can win
        for (let col = 0; col < COLS; col++) {
            const row = findLowestEmptyRow(col);
            if (row !== -1) {
                board[row][col] = AI; // Temporarily place
                if (checkWin(row, col, AI)) {
                    board[row][col] = EMPTY; // Reset
                    makeMove(row, col, AI);
                    return;
                }
                board[row][col] = EMPTY; // Reset
            }
        }
        
        // Check if player can win and block
        for (let col = 0; col < COLS; col++) {
            const row = findLowestEmptyRow(col);
            if (row !== -1) {
                board[row][col] = PLAYER; // Temporarily place
                if (checkWin(row, col, PLAYER)) {
                    board[row][col] = EMPTY; // Reset
                    makeMove(row, col, AI);
                    return;
                }
                board[row][col] = EMPTY; // Reset
            }
        }
        
        // Make a strategic move (preferring center columns)
        const colPriority = [3, 2, 4, 1, 5, 0, 6]; // Center first, then outward
        
        for (const col of colPriority) {
            const row = findLowestEmptyRow(col);
            if (row !== -1) {
                makeMove(row, col, AI);
                return;
            }
        }
    }
    
    function findLowestEmptyRow(col) {
        for (let row = 0; row < ROWS; row++) {
            if (board[row][col] === EMPTY) {
                return row;
            }
        }
        return -1; // Column is full
    }
    
    function checkWin(row, col, player) {
        // Check horizontally
        if (countConsecutive(row, col, 0, 1, player) + countConsecutive(row, col, 0, -1, player) - 1 >= WIN_LENGTH) {
            return true;
        }
        
        // Check vertically
        if (countConsecutive(row, col, 1, 0, player) + countConsecutive(row, col, -1, 0, player) - 1 >= WIN_LENGTH) {
            return true;
        }
        
        // Check diagonal (/)
        if (countConsecutive(row, col, 1, 1, player) + countConsecutive(row, col, -1, -1, player) - 1 >= WIN_LENGTH) {
            return true;
        }
        
        // Check diagonal (\)
        if (countConsecutive(row, col, 1, -1, player) + countConsecutive(row, col, -1, 1, player) - 1 >= WIN_LENGTH) {
            return true;
        }
        
        return false;
    }
    
    function countConsecutive(row, col, rowIncrement, colIncrement, player) {
        let count = 0;
        let currentRow = row;
        let currentCol = col;
        
        while (
            currentRow >= 0 && 
            currentRow < ROWS && 
            currentCol >= 0 && 
            currentCol < COLS && 
            board[currentRow][currentCol] === player
        ) {
            count++;
            currentRow += rowIncrement;
            currentCol += colIncrement;
        }
        
        return count;
    }
    
    function isBoardFull() {
        return board.every(row => row.every(cell => cell !== EMPTY));
    }
    
    function highlightWinningCells() {
        // Iterate through the board to find winning cells
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (board[row][col] !== EMPTY) {
                    const player = board[row][col];
                    
                    // Check each direction
                    const directions = [
                        [0, 1],  // horizontal
                        [1, 0],  // vertical
                        [1, 1],  // diagonal (/)
                        [1, -1]  // diagonal (\)
                    ];
                    
                    for (const [rowIncrement, colIncrement] of directions) {
                        let count = 0;
                        const winningCells = [];
                        
                        // Check in the forward direction
                        for (let i = 0; i < WIN_LENGTH; i++) {
                            const r = row + i * rowIncrement;
                            const c = col + i * colIncrement;
                            
                            if (
                                r >= 0 && r < ROWS && 
                                c >= 0 && c < COLS && 
                                board[r][c] === player
                            ) {
                                count++;
                                winningCells.push([r, c]);
                            } else {
                                break;
                            }
                        }
                        
                        if (count >= WIN_LENGTH) {
                            // Highlight winning cells
                            for (const [r, c] of winningCells) {
                                const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                                cell.classList.add('winning-cell');
                            }
                            return;
                        }
                    }
                }
            }
        }
    }
}); 