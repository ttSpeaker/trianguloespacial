'use strict';

let asteroidSizes = [18, 25, 35];
const faderTime = 0.8;

let keysStatus = {};

function vectorLength(x, y) {
    return Math.sqrt(x * x + y * y);
}

function normalize(x, y) {
    let length = vectorLength(x, y);
    return { x: x / length, y: y / length, length: length };
}

function clamp(x, a, b) {
    return x < a ? a : (x > b ? b : x);
}

function wrap(x, a, b) {
    return x < a ? (b + x - a) : (x > b ? (a + x - b) : x);
}

function wrappedDifference(x, y, a, b) {
    let d1 = wrap(y, a, b) - wrap(x, a, b);
    let d2 = b - a - Math.abs(d1);
    return d1 < d2 ? d1 : d2 * -Math.sign(d1);
}

function cleanUpArray(arr) {
    if (arr.length == 0) {
        return;
    }

    let deleted = 0;
    for (let i = 0; i < arr.length - deleted; i++) {
        arr[i] = arr[i + deleted];
        if (arr[i].alive === false) {
            deleted++;
            i--;
        }
    }

    if (deleted > 0) {
        arr.splice(-deleted);
    }
}


class DrawableEntity {

    constructor(game) {
        this.game = game;
        this.ctx = game.canvasContext;
        this.canvas = this.ctx.canvas;
        this._x = 0;
        this._y = 0;
        this.radius = 0;
        this.alive = true;
    }

    get x() {
        return this._x;
    }

    set x(newX) {
        this._x = wrap(newX, 0, this.canvas.width);
    }
    get y() {
        return this._y;
    }

    set y(newY) {
        this._y = wrap(newY, 0, this.canvas.height);
    }

    circleCircleCollision(otherDrawableEntity) {
        if (this.radius <= 0 || otherDrawableEntity <= 0
            || this.alive === false || otherDrawableEntity.alive === false) {
            return undefined;
        }

        let dx = wrappedDifference(this.x, otherDrawableEntity.x, 0, this.canvas.width);
        let dy = wrappedDifference(this.y, otherDrawableEntity.y, 0, this.canvas.height);

        let radiusOverlap = otherDrawableEntity.radius + this.radius - vectorLength(dx, dy);
        if (radiusOverlap > 0) {
            return { x: dx, y: dy, radiusOverlap: radiusOverlap };
        }

        return undefined;
    }

    frame(dtSec) {
        throw new Error("frame() must be implemented.");
    }

    draw() {
        throw new Error("draw() must be implemented.");
    }
}

class Asteroid extends DrawableEntity {
    constructor(game, x, y, size) {
        super(game);
        this.x = x;
        this.y = y;

        let angle = Math.random() * Math.PI * 2;
        let velocity = 25 + Math.random() * 50;

        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity;

        this.size = size;
        this.radius = asteroidSizes[size];

        let polyNPoints = 7 + Math.floor(Math.random() * 4);
        this.polyPoints = [];
        for (let i = 0; i < polyNPoints; i++) {
            this.polyPoints.push(Math.random() / (2 * polyNPoints) + i / polyNPoints);
        }
    }

    setVelocityComponentSign(sign, cx, cy) {
        let componentProj = this.vx * cx + this.vy * cy;
        let componentProjT = this.vx * -cy + this.vy * cx;

        this.vx = Math.abs(componentProj) * sign * cx - componentProjT * cy;
        this.vy = Math.abs(componentProj) * sign * cy + componentProjT * cx;
    }

    get velocity() {
        return vectorLength(this.vx, this.vy);
    }

    frame(dtSec) {
        this.x += this.vx * dtSec;
        this.y += this.vy * dtSec;
    }

    draw() {
        let ctx = this.ctx;
        ctx.strokeStyle = "#FFFFFF";

        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                ctx.beginPath();
                for (let i = 0; i < this.polyPoints.length; i++) {
                    let point = this.polyPoints[i] * Math.PI * 2;
                    ctx[i == 0 ? "moveTo" : "lineTo"](this.x + Math.cos(point) * this.radius + this.canvas.width * x,
                        this.y + Math.sin(point) * this.radius + this.canvas.height * y);
                }
                ctx.closePath();
                ctx.stroke();
            }
            /*
            ctx.strokeStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
            ctx.stroke();
            */
        }

    }
}

class Bullet extends DrawableEntity {
    constructor(game, x, y, dx, dy) {
        super(game);
        this.x = x;
        this.y = y;
        this.radius = 5;

        let speed = 240;

        this.vx = dx * speed;
        this.vy = dy * speed;
    }

    frame(dtSec) {
        this.x += this.vx * dtSec;
        this.y += this.vy * dtSec;
    }

    draw() {
        let ctx = this.ctx;
        ctx.fillStyle = "#FFFFFF";

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.fill();
    }

}

class TrianguloEspacial extends DrawableEntity {
    constructor(game, x, y, accelPixPerSec, turnRatioDegPerSec, topSpeedPixPerSec) {
        super(game);
        this.x = x;
        this.y = y;
        this.accelPixPerSec = accelPixPerSec;
        this.turnRatioRadPerSec = turnRatioDegPerSec * Math.PI / 180;
        this.topSpeedPixPerSec = topSpeedPixPerSec;
        this.angle = 0;
        this.vx = 0;
        this.vy = 0;
        this.radius = 10;
        this.bulletLock = false;
    }

    getFrontPoint() {
        let frontRad = this.radius * 2;
        return { x: this.x + Math.cos(this.angle) * frontRad, y: this.y + Math.sin(this.angle) * frontRad };
    }

    frame(dtSec) {

        let inputManager = this.game.inputManager;

        if (inputManager.isDown("LEFT") || inputManager.isDown("RIGHT")) {
            let sign = inputManager.isDown("LEFT") ? 1 : -1;
            this.angle -= this.turnRatioRadPerSec * dtSec * sign;
        }

        if (inputManager.isDown("UP") || inputManager.isDown("DOWN")) {
            let sign = inputManager.isDown("UP") ? 1 : -1;
            this.vx += Math.cos(this.angle) * this.accelPixPerSec * dtSec * sign;
            this.vy += Math.sin(this.angle) * this.accelPixPerSec * dtSec * sign;
        }

        if (inputManager.isDown("SPACEBAR")) {
            if (!this.bulletLock) {
                let p = this.getFrontPoint();
                this.game.fireBullet(p.x, p.y, Math.cos(this.angle), Math.sin(this.angle));
                this.bulletLock = true;
            }
        } else {
            this.bulletLock = false;
        }

        let curSpeed = vectorLength(this.vx, this.vy);
        if (curSpeed > 0) {
            let newSpeed = clamp(curSpeed, 0, this.topSpeedPixPerSec);

            this.vx = this.vx * newSpeed / curSpeed;
            this.vy = this.vy * newSpeed / curSpeed;

            this.x += this.vx * dtSec;
            this.y += this.vy * dtSec;
        }
    }

    draw() {
        let ctx = this.ctx;

        ctx.strokeStyle = "#00FF00";
        ctx.beginPath();

        let p = this.getFrontPoint();
        ctx.moveTo(p.x, p.y);

        let rx = Math.cos(this.angle);
        let ry = Math.sin(this.angle);
        let rad = this.radius * 1.5;

        ctx.lineTo(this.x - rx * this.radius - ry * rad, this.y - ry * this.radius + rx * rad);
        ctx.lineTo(this.x - rx * this.radius + ry * rad, this.y - ry * this.radius - rx * rad);
        ctx.closePath();
        ctx.stroke();

        /*
        ctx.strokeStyle = "#FF0000";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.stroke();
        */

    }
}

class GameScene extends DrawableEntity {
    constructor(game, level = 1) {
        super(game);
        this.asteroids = [];
        this.bullets = [];
        this.fader = 0;
        this.faderTrigger = () => { };
        this.level = level;

        for (let i = 0; i < level; i++) {
            let alpha = 2 * Math.PI * i / level;

            this.asteroids.push(new Asteroid(game,
                this.canvas.width * 0.5 * (1 + Math.cos(alpha) * 0.5)
                , this.canvas.height * 0.5 * (1 + Math.sin(alpha) * 0.5)
                , asteroidSizes.length - 1));
        }
        this.trianguloEspacial = new TrianguloEspacial(game, this.canvas.width * 0.5, this.canvas.height * 0.5, 120, 130, 150);
    }

    fireBullet(x, y, dx, dy) {
        if (this.bullets.length < 5) {
            this.bullets.push(new Bullet(game, x, y, dx, dy));
        }
    }

    frame(dtSec) {
        if (this.fader > 0) {
            this.fader -= dtSec;
            if (this.fader <= 0) {
                this.faderTrigger();
            }
            return;
        }

        for (let bullet of this.bullets) {
            bullet.frame(dtSec);
        }

        for (let nAsteroid = 0; nAsteroid < this.asteroids.length; nAsteroid++) {
            let asteroid = this.asteroids[nAsteroid];
            asteroid.frame(dtSec);

            for (let nAsteroid2 = 0; nAsteroid2 < this.asteroids.length; nAsteroid2++) {
                if (nAsteroid != nAsteroid2) {
                    let asteroid2 = this.asteroids[nAsteroid2];
                    let collisionVector = asteroid.circleCircleCollision(asteroid2);
                    if (collisionVector != undefined) {
                        let { x: expulsionVectorX, y: expulsionVectorY } = normalize(collisionVector.x, collisionVector.y);

                        let vProjExp = asteroid.vx * expulsionVectorX + asteroid.vy * expulsionVectorY;

                        asteroid.setVelocityComponentSign(-1, expulsionVectorX, expulsionVectorY);
                        asteroid2.setVelocityComponentSign(-1, -expulsionVectorX, -expulsionVectorY);
                    }
                }

                if (asteroid.circleCircleCollision(this.trianguloEspacial)) {
                    this.fader = faderTime;
                    this.faderTrigger = () => {
                        this.game.curScene = new TitleScene(this.game);
                    };
                }
            }

            for (let bullet of this.bullets) {
                let collisionVector = asteroid.circleCircleCollision(bullet);
                if (collisionVector != undefined) {

                    if (asteroid.size > 0) {
                        let asteroidVelocity = asteroid.velocity * 1.4;
                        let { x: expulsionVectorX, y: expulsionVectorY } = normalize(-collisionVector.y, collisionVector.x);
                        for (let i = 0; i < 2; i++) {
                            let expulsionSign = (i == 0) ? 1 : -1;
                            let expulsionRadius = asteroidSizes[asteroid.size] * expulsionSign;
                            let asteroidFragment = new Asteroid(game, asteroid.x + expulsionVectorX * expulsionRadius, asteroid.y + expulsionVectorY * expulsionRadius, asteroid.size - 1);
                            asteroidFragment.vx = asteroidVelocity * expulsionVectorX * expulsionSign;
                            asteroidFragment.vy = asteroidVelocity * expulsionVectorY * expulsionSign;
                            this.asteroids.push(asteroidFragment);
                        }
                    }

                    asteroid.alive = false;
                    bullet.alive = false;
                    break;
                }
            }

        }

        this.trianguloEspacial.frame(dtSec);

        cleanUpArray(this.bullets);
        cleanUpArray(this.asteroids);

        if (this.asteroids.length == 0) {
            this.fader = faderTime;
            this.faderTrigger = () => {
                this.game.curScene = new GameScene(this.game, this.level + 1);
            };
        }
    }

    draw() {
        for (let asteroid of this.asteroids) {
            asteroid.draw();
        }
        for (let bullet of this.bullets) {
            bullet.draw();
        }
        this.trianguloEspacial.draw();
        if (this.fader > 0) {
            this.ctx.fillStyle = `rgb(0,0,0,${1 - this.fader / faderTime})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}



class TitleScene extends DrawableEntity {
    constructor(game) {
        super(game);
        this.fader = 0;
    }

    frame(dtSec) {
        if (this.fader == 0) {
            if (this.game.inputManager.isDown("SPACEBAR")) {
                this.fader = faderTime;
            }
        } else {
            this.fader -= dtSec;
            if (this.fader <= 0) {
                this.game.curScene = new GameScene(this.game);
            }
        }
    }

    draw() {
        let ctx = this.ctx;
        ctx.textAlign = "center";

        for (let i = 0; i < 20; i++) {
            ctx.font = `${25 + i}px helvetica`;
            if (i == 19) {
                ctx.fillStyle = `#00FF00`;
            }
            else {
                ctx.fillStyle = `rgb(0,${15 + i * 8},0)`;
            }
            ctx.fillText("TRIANGULO ESPACIAL", this.canvas.width * 0.5, 110 + i * 2);
        }
        ctx.font = `30px helvetica`;
        ctx.fillStyle = `#00FF00`;
        ctx.fillText("Press <SPACE> to begin", this.canvas.width * 0.5, 330);
        if (this.fader > 0) {
            ctx.fillStyle = `rgb(0,0,0,${1 - this.fader / faderTime})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}

class InputManager {
    constructor() {
        this.keysStatus = {};

        let keysEnum = {
            32: "SPACEBAR",
            37: "LEFT",
            38: "UP",
            39: "RIGHT",
            40: "DOWN"
        };

        let genKeyListener = (isDown) => {
            return (event) => {
                this.handler(keysEnum[event.keyCode], isDown);
                event.preventDefault();
                event.stopPropagation();
            };
        };

        window.addEventListener("keydown", genKeyListener(true), true);
        window.addEventListener("keyup", genKeyListener(false), true);
    }

    handler(key, isDown) {
        this.keysStatus[key] = isDown;
    }

    isDown(key) {
        return this.keysStatus[key] == true;
    }
}

class Game {
    constructor() {
        let canvas = document.createElement("canvas");
        document.body.appendChild(canvas);
        canvas.width = 640;
        canvas.height = 480;
        this.canvasContext = canvas.getContext("2d");

        this.inputManager = new InputManager();

        this.curScene = new TitleScene(this);

        let onAnimationFrame = (timestampMs) => {
            this.update(timestampMs);
            window.requestAnimationFrame(onAnimationFrame);
        };

        window.requestAnimationFrame(onAnimationFrame);
    }

    fireBullet(x, y, dx, dy) {
        if (this.curScene instanceof GameScene) {
            this.curScene.fireBullet(x, y, dx, dy);
        }
    }

    update(timestampMs) {
        this.prevTimestamp = this.prevTimestamp == undefined ? timestampMs : this.prevTimestamp;
        let dtSec = (timestampMs - this.prevTimestamp) / 1000;
        this.prevTimestamp = timestampMs;

        this.curScene.frame(dtSec);

        let canvas = this.canvasContext.canvas;
        this.canvasContext.fillStyle = "#000000";
        this.canvasContext.fillRect(0, 0, canvas.width, canvas.height);
        this.curScene.draw();
    }
}

let game = new Game();

