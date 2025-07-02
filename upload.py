import firebase_admin
from firebase_admin import credentials, db, firestore
import json
import os

# --- Configuration ---

SERVICE_ACCOUNT_KEY_PATH = 'serviceAccountKey.json'

# Realtime Database URL
DATABASE_URL = "https://mimimi-41a74-default-rtdb.europe-west1.firebasedatabase.app"

# Firestore project ID
PROJECT_ID = "mimimi-41a74"

DATASET_PATH = 'dataset.json'

# --- Initialization ---

def initialize_firebase():
    """Initializes Firebase Admin SDK for Realtime Database and Firestore."""
    if not os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
        print(f"Error: Service account key not found at {SERVICE_ACCOUNT_KEY_PATH}")
        print("Please download your service account key from Firebase Console (Project settings > Service accounts) and place it in the script's directory.")
        return None, None

    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        # Initialize app only once
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred, {
                'databaseURL': DATABASE_URL,
                'projectId': PROJECT_ID,
                'storageBucket': f"{PROJECT_ID}.appspot.com"
            })
        print("Firebase Admin SDK initialized successfully.")
        realtime_db = db
        firestore_db = firestore.client()
        return realtime_db, firestore_db
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        return None, None

# --- Data Upload Functions ---

def upload_book_dataset_realtime(realtime_db):
    """Uploads book data to Firebase Realtime Database under '/books' path."""
    if not os.path.exists(DATASET_PATH):
        print(f"Error: Dataset file not found at {DATASET_PATH}")
        return

    try:
        with open(DATASET_PATH, 'r', encoding='utf-8') as f:
            book_data = json.load(f)

        print('Starting data upload to Firebase Realtime Database...')
        books_ref = realtime_db.reference('books')
        books_ref.set(book_data)

        print('🎉 Data uploaded successfully to /books in Realtime Database!')
        print(f"Number of books uploaded: {len(book_data)}")

    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
    except Exception as e:
        print(f"Unexpected error during Realtime Database upload: {e}")

def upload_book_dataset_firestore(firestore_db):
    """Uploads book data to Firestore collection 'books' (one document per book)."""
    if not os.path.exists(DATASET_PATH):
        print(f"Error: Dataset file not found at {DATASET_PATH}")
        return

    try:
        with open(DATASET_PATH, 'r', encoding='utf-8') as f:
            book_data = json.load(f)

        print('Starting data upload to Firestore...')
        collection_ref = firestore_db.collection('books')

        # Upload each book as a separate document, you can customize the doc ID
        for idx, book in enumerate(book_data):
            doc_id = book.get('id') or f'book_{idx}'  # Use 'id' field if present, else fallback
            collection_ref.document(str(doc_id)).set(book)

        print(f'🎉 Data uploaded successfully to Firestore collection "books"!')
        print(f"Number of books uploaded: {len(book_data)}")

    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
    except Exception as e:
        print(f"Unexpected error during Firestore upload: {e}")

# --- Main execution ---

if __name__ == "__main__":
    realtime_db, firestore_db = initialize_firebase()
    if realtime_db and firestore_db:
        upload_book_dataset_realtime(realtime_db)
        upload_book_dataset_firestore(firestore_db)
    else:
        print("Firebase initialization failed. Aborting data upload.")
