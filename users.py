from flask import Flask, request, jsonify
import firebase_admin
from firebase_admin import credentials, firestore
import json

# Init Flask
app = Flask(__name__)

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


if __name__ == "__main__":
    app.run(debug=True)
