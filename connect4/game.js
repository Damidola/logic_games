document.addEventListener('DOMContentLoaded', () => {
    // Connect Four game class
    class ConnectFourGame {
        constructor() {
            // Constants
            this.ROWS = 6;
            this.COLS = 7;
            this.EMPTY = 0;
            this.PLAYER = 1;
            this.AI = 2;
            this.CONNECT = 4;
            this.DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];
            
            // Game state
            this.board = this.createEmptyBoard();
            this.gameOver = false;
            this.currentDifficulty = 1; // 1-Easy, 2-Medium, 3-Hard
            this.moveHistory = [];
            this.winningCells = [];
            
            // Initialize theme
            this.initializeTheme();
            
            // DOM elements
            this.cacheDOMElements();
            
            // Initialize board
            this.initializeBoard();
            
            // Event listeners
            this.setupEventListeners();
        }
        
        // Create empty board
        createEmptyBoard() {
            return Array(this.ROWS).fill().map(() => Array(this.COLS).fill(this.EMPTY));
        }
        
        // Initialize theme
        initializeTheme() {
            // Set dark theme as default
            document.body.classList.add('dark-theme');
            
            // Load saved theme if available
            if (localStorage.getItem('theme') === 'light') {
                document.body.classList.remove('dark-theme');
            }
        }
        
        // Cache DOM elements for better performance
        cacheDOMElements() {
            this.boardElement = document.getElementById('board');
            this.gameOverElement = document.getElementById('game-over');
            this.playAgainButton = document.getElementById('play-again');
            this.newGameButton = document.getElementById('new-game');
            this.winnerMessage = document.getElementById('winner-message');
            this.difficultyButton = document.getElementById('difficulty-button');
            this.undoButton = document.getElementById('undo-button');
            this.menuDots = this.difficultyButton.querySelectorAll('.menu-dot');
            this.themeToggle = document.getElementById('theme-toggle');
        }
        
        // Initialize game board
        initializeBoard() {
            this.boardElement.innerHTML = '';
            
            for (let col = 0; col < this.COLS; col++) {
                const column = document.createElement('div');
                column.classList.add('column');
                column.dataset.col = col;
                
                for (let row = 0; row < this.ROWS; row++) {
                    const cell = document.createElement('div');
                    cell.classList.add('cell');
                    cell.dataset.row = row;
                    cell.dataset.col = col;
                    column.appendChild(cell);
                }
                
                column.addEventListener('click', () => {
                    if (!this.gameOver) {
                        const col = parseInt(column.dataset.col);
                        this.makeMove(col);
                    }
                });
                
                this.boardElement.appendChild(column);
            }
            
            // Update difficulty dots
            this.updateDifficultyDots();
        }
        
        // Setup event listeners
        setupEventListeners() {
            this.newGameButton.addEventListener('click', () => this.resetGame());
            this.playAgainButton.addEventListener('click', () => this.resetGame());
            this.undoButton.addEventListener('click', () => this.undoMove());
            
            // Difficulty button
            this.difficultyButton.addEventListener('click', () => {
                this.currentDifficulty = (this.currentDifficulty % 3) + 1;
                this.updateDifficultyDots();
            });
            
            // Theme toggle
            if (this.themeToggle) {
                this.themeToggle.addEventListener('click', () => {
                    document.body.classList.toggle('dark-theme');
                    localStorage.setItem('theme', 
                        document.body.classList.contains('dark-theme') ? 'dark' : 'light');
                });
            }
        }
        
        // Update difficulty indicator dots
        updateDifficultyDots() {
            this.menuDots.forEach((dot, index) => {
                dot.classList.toggle('active', index < this.currentDifficulty);
            });
        }
        
        // Update board display
        updateBoard() {
            for (let row = 0; row < this.ROWS; row++) {
                for (let col = 0; col < this.COLS; col++) {
                    const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                    
                    // Remove all player classes
                    cell.classList.remove('player', 'ai');
                    
                    // Add appropriate class
                    if (this.board[row][col] === this.PLAYER) {
                        cell.classList.add('player');
                    } else if (this.board[row][col] === this.AI) {
                        cell.classList.add('ai');
                    }
                }
            }
        }
        
        // Reset game
        resetGame() {
            this.board = this.createEmptyBoard();
            this.gameOver = false;
            this.moveHistory = [];
            this.gameOverElement.classList.remove('active');
            this.updateBoard();
        }
        
        // Check for win
        checkWin(row, col, player) {
            // Directions: horizontal, vertical, diagonal down-right, diagonal up-right
            const directions = [
                [0, 1],  // horizontal
                [1, 0],  // vertical
                [1, 1],  // diagonal down-right
                [-1, 1]  // diagonal up-right
            ];
            
            for (const [dx, dy] of directions) {
                let count = 1;  // Count current cell
                
                // Check forward direction
                for (let i = 1; i < this.CONNECT; i++) {
                    const r = row + i * dx;
                    const c = col + i * dy;
                    
                    if (this.isValidCell(r, c) && this.board[r][c] === player) {
                        count++;
                    } else {
                        break;
                    }
                }
                
                // Check backward direction
                for (let i = 1; i < this.CONNECT; i++) {
                    const r = row - i * dx;
                    const c = col - i * dy;
                    
                    if (this.isValidCell(r, c) && this.board[r][c] === player) {
                        count++;
                    } else {
                        break;
                    }
                }
                
                // If found 4 in a row, return true
                if (count >= this.CONNECT) {
                    return true;
                }
            }
            
            return false;
        }
        
        // Check if cell coordinates are valid
        isValidCell(row, col) {
            return row >= 0 && row < this.ROWS && col >= 0 && col < this.COLS;
        }
        
        // Check if move is valid
        isValidMove(col) {
            return this.board[this.ROWS - 1][col] === this.EMPTY;
        }
        
        // Get first empty row in column
        getFirstEmptyRow(col) {
            for (let row = 0; row < this.ROWS; row++) {
                if (this.board[row][col] === this.EMPTY) {
                    return row;
                }
            }
            return -1;
        }
        
        // Make player move
        makeMove(col) {
            if (!this.isValidMove(col) || this.gameOver) return false;
            
            const row = this.getFirstEmptyRow(col);
            this.board[row][col] = this.PLAYER;
            this.moveHistory.push({row, col, player: this.PLAYER});
            
            this.updateBoard();
            
            // Check if player won
            if (this.checkWin(row, col, this.PLAYER)) {
                this.winnerMessage.textContent = 'Ви перемогли!';
                this.gameOver = true;
                this.gameOverElement.classList.add('active');
                return true;
            }
            
            // Check for draw
            if (this.isBoardFull()) {
                this.winnerMessage.textContent = 'Нічия!';
                this.gameOver = true;
                this.gameOverElement.classList.add('active');
                return true;
            }
            
            // AI move
            setTimeout(() => {
                this.makeAIMove();
            }, 300);
            
            return true;
        }
        
        // Check if board is full (draw)
        isBoardFull() {
            return this.board.every(row => row.every(cell => cell !== this.EMPTY));
        }
        
        // Undo last move
        undoMove() {
            if (this.moveHistory.length < 2 || this.gameOver) return;
            
            // Undo both player and AI moves
            for (let i = 0; i < 2; i++) {
                if (this.moveHistory.length > 0) {
                    const move = this.moveHistory.pop();
                    this.board[move.row][move.col] = this.EMPTY;
                }
            }
            
            this.updateBoard();
        }
        
        // Evaluate board state for minimax
        evaluateBoard() {
            // Directions: horizontal, vertical, diagonal down-right, diagonal up-right
            const directions = [
                [0, 1],  // horizontal
                [1, 0],  // vertical
                [1, 1],  // diagonal down-right
                [-1, 1]  // diagonal up-right
            ];
            
            let score = 0;
            
            for (let row = 0; row < this.ROWS; row++) {
                for (let col = 0; col < this.COLS; col++) {
                    if (this.board[row][col] !== this.EMPTY) {
                        const player = this.board[row][col];
                        const value = player === this.AI ? 1 : -1;
                        
                        for (const [dx, dy] of directions) {
                            let count = 1;
                            let isEmpty = false;
                            
                            // Check forward direction
                            for (let i = 1; i < this.CONNECT; i++) {
                                const r = row + i * dx;
                                const c = col + i * dy;
                                
                                if (this.isValidCell(r, c)) {
                                    if (this.board[r][c] === player) {
                                        count++;
                                    } else if (this.board[r][c] === this.EMPTY) {
                                        isEmpty = true;
                                        break;
                                    } else {
                                        break;
                                    }
                                }
                            }
                            
                            // If there are at least 2 in a row and an empty space for potential win
                            if (count >= 2 && isEmpty) {
                                score += count * value;
                            }
                            
                            // If there are 4 in a row, large bonus
                            if (count >= this.CONNECT) {
                                score += 100 * value;
                            }
                        }
                    }
                }
            }
            
            return score;
        }
        
        // Minimax algorithm with alpha-beta pruning
        minimax(depth, alpha, beta, isMaximizingPlayer) {
            // Check for immediate win/loss
            for (let row = 0; row < this.ROWS; row++) {
                for (let col = 0; col < this.COLS; col++) {
                    if (this.board[row][col] !== this.EMPTY) {
                        if (this.checkWin(row, col, this.PLAYER)) {
                            return {score: -100 - depth};
                        }
                        if (this.checkWin(row, col, this.AI)) {
                            return {score: 100 + depth};
                        }
                    }
                }
            }
            
            // Check depth and draw
            if (depth === 0 || this.isBoardFull()) {
                return {score: this.evaluateBoard()};
            }
            
            if (isMaximizingPlayer) {
                let maxScore = -Infinity;
                let bestCol = null;
                
                // Try all possible moves
                for (let col = 0; col < this.COLS; col++) {
                    if (this.isValidMove(col)) {
                        const row = this.getFirstEmptyRow(col);
                        this.board[row][col] = this.AI;
                        
                        // Recursively call minimax for next level
                        const result = this.minimax(depth - 1, alpha, beta, false);
                        
                        // Undo move
                        this.board[row][col] = this.EMPTY;
                        
                        if (result.score > maxScore) {
                            maxScore = result.score;
                            bestCol = col;
                        }
                        
                        // Alpha-beta pruning
                        alpha = Math.max(alpha, maxScore);
                        if (alpha >= beta) break;
                    }
                }
                
                return {score: maxScore, col: bestCol};
            } else {
                let minScore = Infinity;
                let bestCol = null;
                
                // Try all possible moves
                for (let col = 0; col < this.COLS; col++) {
                    if (this.isValidMove(col)) {
                        const row = this.getFirstEmptyRow(col);
                        this.board[row][col] = this.PLAYER;
                        
                        // Recursively call minimax for next level
                        const result = this.minimax(depth - 1, alpha, beta, true);
                        
                        // Undo move
                        this.board[row][col] = this.EMPTY;
                        
                        if (result.score < minScore) {
                            minScore = result.score;
                            bestCol = col;
                        }
                        
                        // Alpha-beta pruning
                        beta = Math.min(beta, minScore);
                        if (alpha >= beta) break;
                    }
                }
                
                return {score: minScore, col: bestCol};
            }
        }
        
        // Random move for AI
        randomMove() {
            const validCols = [];
            for (let col = 0; col < this.COLS; col++) {
                if (this.isValidMove(col)) {
                    validCols.push(col);
                }
            }
            
            if (validCols.length > 0) {
                return validCols[Math.floor(Math.random() * validCols.length)];
            }
            
            return -1;
        }
        
        // Make AI move
        makeAIMove() {
            if (this.gameOver) return;
            
            let col;
            
            // Based on difficulty level
            switch (this.currentDifficulty) {
                case 1: // Easy - random move
                    col = this.randomMove();
                    break;
                case 2: // Medium - minimax with low depth
                    col = this.minimax(2, -Infinity, Infinity, true).col;
                    break;
                case 3: // Hard - minimax with higher depth
                    col = this.minimax(4, -Infinity, Infinity, true).col;
                    break;
                default:
                    col = this.randomMove();
                    break;
            }
            
            if (col !== -1 && this.isValidMove(col)) {
                const row = this.getFirstEmptyRow(col);
                this.board[row][col] = this.AI;
                this.moveHistory.push({row, col, player: this.AI});
                
                this.updateBoard();
                
                // Check if AI won
                if (this.checkWin(row, col, this.AI)) {
                    this.winnerMessage.textContent = 'Комп\'ютер переміг!';
                    this.gameOver = true;
                    this.gameOverElement.classList.add('active');
                }
                
                // Check for draw
                else if (this.isBoardFull()) {
                    this.winnerMessage.textContent = 'Нічия!';
                    this.gameOver = true;
                    this.gameOverElement.classList.add('active');
                }
            }
        }
    }
    
    // Initialize the game
    const game = new ConnectFourGame();
}); 