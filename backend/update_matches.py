import mysql.connector
import json
import os
from app.matching.datastore import KeywordStore
from app.matching.matcher import Matcher

# MATCH EXACT API LOADING
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "app")
DATA_DIR = os.path.join(BACKEND_DIR, "data")

DIAGNOSTIC_CSV = os.path.join(DATA_DIR, "keywords_diagnostic.csv")
ENDO_CSV = os.path.join(DATA_DIR, "keywords_endo.csv")

STORE = KeywordStore()
STORE.load_csv(DIAGNOSTIC_CSV, category="Diagnostic")
STORE.load_csv(ENDO_CSV, category="Endo")

MATCHER = Matcher(STORE)

# DB CONNECTION
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="",
    database="tender_automation_with_ai"
)
cursor = db.cursor(dictionary=True)

cursor.execute("""
    SELECT id, bid_number, items
    FROM gem_tenders
    WHERE matches_status = 'No'
""")
rows = cursor.fetchall()

update_sql = """
    UPDATE gem_tenders
    SET 
        matches = %s,
        match_count = %s,
        match_relevency = %s,
        matches_status = 'Yes'
    WHERE id = %s
"""

for row in rows:
    tender_id = row["id"]
    items_text = row["items"] or ""

    # EXACT API BEHAVIOR
    result = MATCHER.analyze(items_text, category_filter="all")

    matches_list = result.get("matches", [])
    match_count = result.get("matched_count", len(matches_list))

    # THIS IS THE REAL RELEVANCY SCORE (0–100)
    match_relevency_value = result.get("score_pct", 0)

    # Store matches JSON
    matches_json = json.dumps(matches_list, ensure_ascii=False)

    cursor.execute(update_sql, (
        matches_json,
        match_count,
        match_relevency_value,
        tender_id
    ))
    db.commit()

    print(
        f"Updated ID {tender_id} | Matches={match_count} | Relevency={match_relevency_value}%"
    )

db.close()
print("Completed.")
