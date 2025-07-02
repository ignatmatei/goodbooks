from flask import Flask, request, jsonify
import firebase_admin
from firebase_admin import credentials, firestore
import json

# Init Flask
app = Flask(__name__)
# Load dataset.json once
with open('dataset.json', 'r') as f:
    books_data = json.load(f)

# Map books by book_id for fast lookup
book_map = {book['book_id']: book for book in books_data}

# Load Firebase config and initialize Firebase app
cred = credentials.Certificate("firebase_config.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Collection name in Firebase
COLLECTION = "users"


# Load mock data from users.json or define inline
def load_mock_data():
    with open("users.json", "r") as f:
        return json.load(f)


# Route to populate Firebase with initial data
@app.route("/init", methods=["POST"])
def init_data():
    users = load_mock_data()
    for user in users:
        db.collection(COLLECTION).document(user["user_id"]).set(user)
    return jsonify({"message": f"Inserted {len(users)} users"}), 201


# Get all users
@app.route("/users", methods=["GET"])
def get_users():
    docs = db.collection(COLLECTION).stream()
    users = [doc.to_dict() for doc in docs]
    return jsonify(users)


# Get one user by ID
@app.route("/users/<user_id>", methods=["GET"])
def get_user(user_id):
    doc = db.collection(COLLECTION).document(user_id).get()
    if doc.exists:
        return jsonify(doc.to_dict())
    return jsonify({"error": "User not found"}), 404


# Create new user
@app.route("/users", methods=["POST"])
def create_user():
    user = request.json
    user_id = user.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    db.collection(COLLECTION).document(user_id).set(user)
    return jsonify({"message": "User created"}), 201


# Update user
@app.route("/users/<user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.json
    db.collection(COLLECTION).document(user_id).update(data)
    return jsonify({"message": "User updated"}), 200


# Delete user
@app.route("/users/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    db.collection(COLLECTION).document(user_id).delete()
    return jsonify({"message": "User deleted"}), 200

# ✅ --- Get all books a user is reading, with full info ---

@app.route("/books/<book_id>", methods=["GET"])
def get_book_by_id(book_id):
    """
    Fetch a single book's info from Realtime Database by its ID.
    """
    try:
        # 1️⃣ Get reference to the /books/{book_id} path in Realtime Database
        book_ref = db.reference(f"books_{book_id}")

        # 2️⃣ Get the book data
        book_data = book_ref.get()

        if not book_data:
            return jsonify({"error": "Book not found"}), 404

        # 3️⃣ Return it as JSON
        return jsonify(book_data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/book/<book_id>', methods=['GET'])
def get_book(book_id):
    try:
        books_ref = db.reference('books')
        books_data = books_ref.get()

        if not books_data:
            return jsonify({'error': 'No books found in the database'}), 404

        for key, book in books_data.items():
            if book.get('book_id') == book_id:
                return jsonify(book), 200

        return jsonify({'error': f"No book found with book_id '{book_id}'"}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500


import google.generativeai as genai  # make sure this is at the top

# Load your Gemini API key
GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'  # Replace with your actual key

# === Route: Get book recommendation ===
import requests
@app.route('/book_by_key/<doc_key>', methods=['GET'])
def get_book_by_key(doc_key):
    try:
        book_ref = db.reference(f'books/{doc_key}')
        print(f"Fetching book with key: {doc_key}")
        book_data = book_ref.get()

        if book_data:
            return jsonify(book_data), 200
        else:
            return jsonify({'error': f'No book found with key "{doc_key}"'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500

from flask import Flask, jsonify, request
import requests
from google import genai
from google.genai import types
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY is None:
    raise ValueError("GEMINI_API_KEY is not set")

client = genai.Client(api_key=GEMINI_API_KEY)

@app.route("/users/<user_id>/recommendation", methods=["GET"])
def get_book_recommendation(user_id):
    try:
        books_api_url = f"http://localhost:5000/users/{user_id}/books"
        response = requests.get(books_api_url)
        response.raise_for_status()
        data = response.json()
        books = data.get("books", [])
    except requests.RequestException as e:
        return jsonify({"error": f"Failed to fetch books: {str(e)}"}), 500

    if not books:
        return jsonify({"error": "User has no books"}), 400

    book_details = ', '.join(
        f"{book['title']} (Author: {book.get('author', 'N/A')}, Genre: {', '.join(book.get('genre', [])) if isinstance(book.get('genre'), list) else book.get('genre', 'N/A')})"
        for book in books
    )

    # Only allow recommendations from titles in dataset.json
    available_titles = [book['title'] for book in books_data]
    prompt = (
        f"Based on these books the user has read: {book_details}, "
        f"choosing only from these titles: {', '.join(available_titles)}. "
        f"Answer with the top 5 book title and id. Top 5 recommendations are: "
    )

    # Use your working genai client call
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0)  # disables thinking
        ),
    )

    return jsonify({
        "recommendation": response.text.strip()
    })

@app.route("/users/<user_id>/books", methods=["GET"])
def get_user_books(user_id):
    doc = db.collection(COLLECTION).document(user_id).get()
    if not doc.exists:
        return jsonify({"error": "User not found"}), 404

    user_data = doc.to_dict()
    user_book_ids = user_data.get("book_ids", [])
    
    # Look up each book ID in the preloaded dataset
    user_books = [book_map[book_id] for book_id in user_book_ids if book_id in book_map]
    
    return jsonify

import random
@app.route("/random_book", methods=["GET"])
def get_random_book():
    max_id = 29
    random_id = random.randint(0, max_id)
    random_book = books_data[random_id]
    return jsonify({
        "title": random_book["title"],
        "author": random_book["author"]
    })
if __name__ == "__main__":
    app.run(debug=True)
