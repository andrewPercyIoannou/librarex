import axios from "axios";
import express from "express";
import pg from 'pg';




const port = 3000;
const app = express();
//middleware
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"));
app.set("view engine", "ejs");

const db = new pg.Client({
    user: "postgres",
    host: 'localhost',
    database: "books",
    password: "Melanie2000",
    port: 5432
});
db.connect();

// get cover!!
// const openLibrary = "https://openlibrary.org/search.json?title="
// get the user input to add below instead of the hobbit
// const response = await axios.get(openLibrary + "the hobbit");
// const book = response.data.docs[0];
// console.log(book.cover_i)
 //the url for the cover of the user inputs book from the api
//// const cover=`https://covers.openlibrary.org/b/id/${book.cover_i}-S.jpg`;

app.get("/", async (req,res) =>{
    const result = await db.query('SELECT * FROM books ORDER BY id ASC');
    const books = result.rows;
    console.log(books)
    res.render("home.ejs", {books})
})

app.post("/addBook", async (req, res) => {
    const book = req.body.addBook;
    const review = req.body.review;
    const rating = req.body.rating;
    
    console.log(book, review, rating); // check what's being received
    
    try {
        await db.query(
            "INSERT INTO books (title, review, rating) VALUES ($1, $2, $3)",
            [book, review, rating]
        );
        res.redirect("/");
    } catch (err) {
        console.log(err); 
        res.redirect("/");
    }
});

app.get("/book/:id", async (req, res) => {
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
                error: "We couldn't find this book in our library. Try editing the title to match the exact book name."
            });
        }

        const cover = `https://covers.openlibrary.org/b/id/${bookData.cover_i}-M.jpg`;
        res.render("book.ejs", { book, cover, error: null });

    } catch (err) {
        console.log(err);
        res.render("book.ejs", { book, cover: null, error: "Something went wrong fetching the cover." });
    }
});

app.post("/delete", async(req,res) =>{
    const id = req.body.id;
    await db.query("DELETE FROM books WHERE id = $1", [id]);
    res.redirect("/");
})

app.post("/edit/:id", async (req, res) => {
    const id = req.params.id;
    const { title, review, rating } = req.body;
    await db.query(
        "UPDATE books SET title = $1, review = $2, rating = $3 WHERE id = $4",
        [title, review, rating, id]
    );
    res.redirect("/");
});

app.listen(port, ()=>{
    console.log("Listening")
});