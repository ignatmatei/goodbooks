from storygraph_api import Book

def get_first_10_books():
    book_client = Book()
    # Call the `browse` method, which is implemented in books_client.py
    result = book_client.browse(page=1, per_page=10)

    for idx, book in enumerate(result, 1):
        print(f"{idx}. {book['title']} by {', '.join(book['authors'])}")

if __name__ == "__main__":
    get_first_10_books()
