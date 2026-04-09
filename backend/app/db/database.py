import sqlite3
import os
from pathlib import Path

# Connect to the database in the backend directory
DB_PATH = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))) / "codeworld.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Table for recent repos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_recent_repos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            repo_full_name TEXT NOT NULL,
            repo_url TEXT NOT NULL,
            accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(username, repo_full_name)
        )
    """)
    
    # Table for user sessions
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_sessions (
            session_token TEXT PRIMARY KEY,
            github_token TEXT NOT NULL,
            username TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            is_logged_in INTEGER NOT NULL DEFAULT 1
        )
    """)
    
    # Table for favourite repos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_favourite_repos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            repo_full_name TEXT NOT NULL,
            repo_url TEXT NOT NULL,
            added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(username, repo_full_name)
        )
    """)
    
    conn.commit()
    conn.close()

# Helper access functions for Recent Repos

def upsert_recent_repo(username: str, repo_full_name: str, repo_url: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_recent_repos (username, repo_full_name, repo_url, accessed_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(username, repo_full_name) 
        DO UPDATE SET accessed_at=CURRENT_TIMESTAMP
    """, (username, repo_full_name, repo_url))
    conn.commit()
    conn.close()

def get_recent_repos(username: str, limit: int = 20):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT repo_full_name, repo_url, accessed_at 
        FROM user_recent_repos 
        WHERE username = ? 
        ORDER BY accessed_at DESC 
        LIMIT ?
    """, (username, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# Helper access functions for Favourite Repos

def add_favourite_repo(username: str, repo_full_name: str, repo_url: str):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO user_favourite_repos (username, repo_full_name, repo_url)
            VALUES (?, ?, ?)
        """, (username, repo_full_name, repo_url))
        conn.commit()
    except sqlite3.IntegrityError:
        # Already a favourite, do nothing
        pass
    finally:
        conn.close()

def remove_favourite_repo(username: str, repo_full_name: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        DELETE FROM user_favourite_repos 
        WHERE username = ? AND repo_full_name = ?
    """, (username, repo_full_name))
    conn.commit()
    conn.close()

def get_favourite_repos(username: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT repo_full_name, repo_url, added_at 
        FROM user_favourite_repos 
        WHERE username = ? 
        ORDER BY added_at DESC
    """, (username,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
