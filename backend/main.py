from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import mysql.connector

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="leela", # 🚨 CHANGE THIS
        database="waypoint_rit"
    )

# --- MODELS ---
class BuildingModel(BaseModel):
    name: str; total_floors: int; entrance_x: float; entrance_y: float; icon: str; color: str; footprint_coordinates: str
class RoomModel(BaseModel):
    room_id: str; building_id: int; floor_level: int; room_type: str; coordinate_x: float; coordinate_y: float; footprint_coordinates: str; branch: Optional[str] = "General"; z_coordinate: float = 3.5
class MessageModel(BaseModel):
    message: str; type: str

@app.get("/")
def read_root(): return {"status": "Backend is running!"}

# --- GET ENDPOINTS (Frontend & Admin) ---
@app.get("/admin/buildings")
def get_buildings():
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT building_id, name, total_floors, entrance_x, entrance_y, icon, color, footprint_coordinates FROM Buildings")
    res = cursor.fetchall(); conn.close(); return res

@app.get("/admin/rooms")
def get_rooms():
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT r.room_id, r.building_id, r.floor_level, r.room_type, r.footprint_coordinates, r.z_coordinate, b.name as building_name FROM Rooms r JOIN Buildings b ON r.building_id = b.building_id")
    res = cursor.fetchall(); conn.close(); return res

@app.get("/live-data")
def get_messages():
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT status_id, message, type FROM SystemStatus ORDER BY status_id DESC")
    res = cursor.fetchall(); conn.close(); return res

@app.get("/search/{query}")
def search_location(query: str):
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT r.room_id as id, r.coordinate_x as global_x, r.coordinate_y as global_y, 'room' as type, b.name as building_name, r.building_id, r.floor_level, b.total_floors FROM Rooms r JOIN Buildings b ON r.building_id = b.building_id WHERE r.room_id LIKE %s LIMIT 1", (f"%{query}%",))
    res = cursor.fetchone()
    if not res:
        cursor.execute("SELECT building_id as id, entrance_x as global_x, entrance_y as global_y, 'building' as type, name as building_name, building_id, total_floors FROM Buildings WHERE name LIKE %s LIMIT 1", (f"%{query}%",))
        res = cursor.fetchone()
    conn.close()
    if not res: raise HTTPException(status_code=404, detail="Not found")
    return res

# --- POST ENDPOINTS (Admin Saves) ---
@app.post("/admin/building")
def add_building(b: BuildingModel):
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("INSERT INTO Buildings (name, total_floors, entrance_x, entrance_y, icon, color, footprint_coordinates) VALUES (%s, %s, %s, %s, %s, %s, %s)", (b.name, b.total_floors, b.entrance_x, b.entrance_y, b.icon, b.color, b.footprint_coordinates))
    conn.commit(); conn.close(); return {"msg": "Saved"}

@app.post("/admin/room")
def add_room(r: RoomModel):
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("INSERT INTO Rooms (room_id, building_id, floor_level, room_type, branch, coordinate_x, coordinate_y, footprint_coordinates, z_coordinate) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)", (r.room_id, r.building_id, r.floor_level, r.room_type, r.branch, r.coordinate_x, r.coordinate_y, r.footprint_coordinates, r.z_coordinate))
    conn.commit(); conn.close(); return {"msg": "Saved"}

@app.post("/admin/status")
def add_message(m: MessageModel):
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("INSERT INTO SystemStatus (message, type) VALUES (%s, %s)", (m.message, m.type))
    conn.commit(); conn.close(); return {"msg": "Saved"}

# --- DELETE ENDPOINTS (Admin Removes) ---
@app.delete("/admin/building/{id}")
def del_building(id: int):
    conn = get_db_connection(); cursor = conn.cursor(); cursor.execute("DELETE FROM Buildings WHERE building_id=%s", (id,)); conn.commit(); conn.close(); return {"msg": "Deleted"}

@app.delete("/admin/room/{id}")
def del_room(id: str):
    conn = get_db_connection(); cursor = conn.cursor(); cursor.execute("DELETE FROM Rooms WHERE room_id=%s", (id,)); conn.commit(); conn.close(); return {"msg": "Deleted"}

@app.delete("/admin/status/{id}")
def del_message(id: int):
    conn = get_db_connection(); cursor = conn.cursor(); cursor.execute("DELETE FROM SystemStatus WHERE status_id=%s", (id,)); conn.commit(); conn.close(); return {"msg": "Deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)