const X_CLASS = 'x';
const O_CLASS = 'o';
const WINNING_COMBINATIONS = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

const cellElements = document.querySelectorAll('[data-cell]');
const board = document.getElementById('board');
const boardContainer = document.getElementById('boardContainer');
const winningMessageElement = document.getElementById('winningMessage');
const restartButton = document.getElementById('restartButton');
const winningMessageTextElement = document.querySelector('[data-winning-message-text]');
const startScreen = document.getElementById('startScreen');
const selectXButton = document.getElementById('selectX');
const selectOButton = document.getElementById('selectO');
const winningLineElement = document.getElementById('winningLine');

let playerClass;
let computerClass;
let isPlayerTurn;

selectXButton.addEventListener('click', () => selectSymbol(X_CLASS));
selectOButton.addEventListener('click', () => selectSymbol(O_CLASS));
restartButton.addEventListener('click', showStartScreen);

function selectSymbol(symbol) {
    playerClass = symbol;
    computerClass = symbol === X_CLASS ? O_CLASS : X_CLASS;
    startScreen.style.display = 'none';
    boardContainer.style.display = 'block'; 
    startGame();
}

function showStartScreen() {
    startScreen.style.display = 'flex'; // Or 'block' depending on your CSS for startScreen
    boardContainer.style.display = 'none';
    winningMessageElement.classList.remove('show');
    winningLineElement.className = 'winning-line';
    winningLineElement.style.display = 'none';
}

function startGame() {
    isPlayerTurn = playerClass === X_CLASS;
    cellElements.forEach(cell => {
        cell.classList.remove(X_CLASS);
        cell.classList.remove(O_CLASS);
        cell.removeEventListener('click', handleClick);
        cell.addEventListener('click', handleClick, { once: true });
    });
    setBoardHoverClass();
    winningMessageElement.classList.remove('show');
    winningLineElement.className = 'winning-line';
    winningLineElement.style.display = 'none';
    if (!isPlayerTurn) {
        setTimeout(computerMove, 500);
    }
}

function handleClick(e) {
    if (!isPlayerTurn) return;

    const cell = e.target;
    if (cell.classList.contains(X_CLASS) || cell.classList.contains(O_CLASS)) {
        return;
    }

    placeMark(cell, playerClass);
    const win = checkWin(playerClass);
    if (win) {
        drawWinningLine(win.combination, win.type);
        setTimeout(() => {
            endGame(false, true);
        }, 2000);
    } else if (isDraw()) {
        endGame(true);
    } else {
        swapTurns();
        setBoardHoverClass();
        setTimeout(computerMove, 500);
    }
}

function computerMove() {
    if (isPlayerTurn) return;

    const availableCells = [...cellElements].filter(cell => {
        return !cell.classList.contains(X_CLASS) && !cell.classList.contains(O_CLASS);
    });

    if (availableCells.length === 0) return;

    const randomIndex = Math.floor(Math.random() * availableCells.length);
    const cell = availableCells[randomIndex];

    placeMark(cell, computerClass);
    const win = checkWin(computerClass);

    if (win) {
        drawWinningLine(win.combination, win.type);
        setTimeout(() => {
             endGame(false, false);
        }, 2000);
    } else if (isDraw()) {
        endGame(true);
    } else {
        swapTurns();
        setBoardHoverClass();
    }
}

function endGame(draw, playerWon) {
    if (draw) {
        winningMessageTextElement.innerText = 'Нічия!';
    } else {
        winningMessageTextElement.innerText = `${playerWon ? "Ви Виграли!" : "Комп'ютер Виграв!"} 🎉`;
    }
    winningMessageElement.classList.add('show');
    cellElements.forEach(cell => cell.removeEventListener('click', handleClick));
}

function isDraw() {
    return [...cellElements].every(cell => {
        return cell.classList.contains(X_CLASS) || cell.classList.contains(O_CLASS);
    });
}

function placeMark(cell, classToAdd) {
    cell.classList.add(classToAdd);
}

function swapTurns() {
    isPlayerTurn = !isPlayerTurn;
}

function setBoardHoverClass() {
    board.classList.remove(X_CLASS);
    board.classList.remove(O_CLASS);
    if (isPlayerTurn) {
       board.classList.add(playerClass);
    } 
}

function checkWin(currentClass) {
    for (let i = 0; i < WINNING_COMBINATIONS.length; i++) {
        const combination = WINNING_COMBINATIONS[i];
        const win = combination.every(index => {
            return cellElements[index].classList.contains(currentClass);
        });
        if (win) {
            let type = '';
            if (i <= 2) type = `h${i+1}`;
            else if (i <= 5) type = `v${i-2}`;
            else if (i === 6) type = 'd1';
            else type = 'd2';
            return { combination: combination, type: type };
        }
    }
    return false;
}

function drawWinningLine(combination, type) {
    winningLineElement.className = 'winning-line';
    winningLineElement.classList.add(type);
    winningLineElement.style.display = 'block';
    requestAnimationFrame(() => {
        winningLineElement.classList.add('show');
    });
}

showStartScreen(); 