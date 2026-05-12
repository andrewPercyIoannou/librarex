import axios from "axios";
import express from "express";
import pg from 'pg';
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import dotenv from "dotenv";
dotenv.config();

const port = 3000;
const app = express();

app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

const { Pool } = pg;
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
}

// auth routes
app.get("/login", (req, res) => {
    res.render("login.ejs");
});

app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.post("/register", async (req, res) => {
    const { email, password } = req.body;
    try {
        const exists = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (exists.rows.length > 0) {
            return res.redirect("/login");
        }
        const hash = await bcrypt.hash(password, 10);
        const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *", [email, hash]
        );
        const user = result.rows[0];
        // log the user in straight after registering
        req.login(user, (err) => {
            if (err) console.log(err);
            res.redirect("/");
        });
    } catch (err) {
        console.log(err);
    }
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login"
}));


app.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) console.log(err);
        res.redirect("/login");
    });
});

// protected routes
app.get("/", isAuthenticated, async (req, res) => {
    const result = await db.query(
        "SELECT * FROM books WHERE user_id = $1 ORDER BY id ASC",
        [req.user.id]
    );
    const books = result.rows;
    res.render("home.ejs", { books });
});

app.post("/addBook", isAuthenticated, async (req, res) => {
    const book = req.body.addBook;
    const review = req.body.review;
    const rating = req.body.rating;
    try {
        await db.query(
            "INSERT INTO books (title, review, rating, user_id) VALUES ($1, $2, $3, $4)",
            [book, review, rating, req.user.id]
        );
        res.redirect("/");
    } catch (err) {
        console.log(err);
        res.redirect("/");
    }
});

app.get("/book/:id", isAuthenticated, async (req, res) => {
    const id = req.params.id;
    const result = await db.query("SELECT * FROM books WHERE id = $1", [id]);
    const book = result.rows[0];
    const openLibrary = "https://openlibrary.org/search.json?title=";
    try {
        const response = await axios.get(openLibrary + book.title);
        const bookData = response.data.docs[0];
        if (!bookData || !bookData.cover_i) {
            return res.render("book.ejs", {
                book,
                cover: null,
                error: "We couldn't find this book. Try editing the title to match the exact book name."
            });
        }
        const cover = `https://covers.openlibrary.org/b/id/${bookData.cover_i}-M.jpg`;
        res.render("book.ejs", { book, cover, error: null });
    } catch (err) {
        console.log(err);
        res.render("book.ejs", { book, cover: null, error: "Something went wrong fetching the cover." });
    }
});

app.post("/delete", isAuthenticated, async (req, res) => {
    const id = req.body.id;
    await db.query("DELETE FROM books WHERE id = $1", [id]);
    res.redirect("/");
});

app.post("/edit/:id", isAuthenticated, async (req, res) => {
    const id = req.params.id;
    const { title, review, rating } = req.body;
    await db.query(
        "UPDATE books SET title = $1, review = $2, rating = $3 WHERE id = $4",
        [title, review, rating, id]
    );
    res.redirect("/");
});

passport.use(new Strategy({ usernameField: "email" }, async (email, password, cb) => {
    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            return cb(null, false);
        }
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            return cb(null, user);
        } else {
            return cb(null, false);
        }
    } catch (err) {
        return cb(err);
    }
}));

passport.serializeUser((user, cb) => {
    cb(null, user.id);
});

passport.deserializeUser(async (id, cb) => {
    try {
        const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
        cb(null, result.rows[0]);
    } catch (err) {
        cb(err);
    }
});

app.listen(port, () => {
    console.log("Listening");
});