# # scheduler-service/scheduler.py
# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from ortools.sat.python import cp_model
# import logging

# app = Flask(__name__)
# CORS(app)
# logging.basicConfig(level=logging.INFO)

# @app.route('/generate', methods=['POST'])
# def generate():
#     data = request.get_json()
#     if not data:
#         return jsonify({"error":"no payload"}), 400

#     subjects = data.get('subjects', [])
#     instructors = data.get('instructors', [])
#     rooms = data.get('rooms', [])
#     days = data.get('days', ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"])
#     slots_per_day = int(data.get('slotsPerDay', 8))
#     section_count = int(data.get('sectionCount', 1))
#     students_count = int(data.get('studentsCount', 30))

#     # minimal validation
#     if not subjects or not rooms:
#         return jsonify({"error":"subjects and rooms required"}), 400

#     # Build slot pairs
#     day_indices = list(range(len(days)))
#     slot_indices = list(range(slots_per_day))
#     slot_pairs = [(d,s) for d in day_indices for s in slot_indices]
#     T = len(slot_pairs)
#     S = len(subjects)
#     Q = int(section_count)

#     model = cp_model.CpModel()

#     # y[s][q][t] = subject s for section q scheduled in slot t
#     y = {}
#     for s_idx in range(S):
#         for q in range(Q):
#             for t in range(T):
#                 y[(s_idx,q,t)] = model.NewBoolVar(f"y_s{s_idx}_q{q}_t{t}")

#     # Each subject-section needs `units` slots
#     for s_idx, subj in enumerate(subjects):
#         units = max(1, int(subj.get('units', 3)))
#         for q in range(Q):
#             model.Add(sum(y[(s_idx,q,t)] for t in range(T)) == units)

#     # No two different subjects for same section in same slot
#     for q in range(Q):
#         for t in range(T):
#             model.Add(sum(y[(s_idx,q,t)] for s_idx in range(S)) <= 1)

#     # Optional: spread sessions across days if units > 1 (1 session per day)
#     for s_idx in range(S):
#         units = max(1, int(subjects[s_idx].get('units', 3)))
#         if units > 1:
#             for d in day_indices:
#                 slots_this_day = [t for t,p in enumerate(slot_pairs) if p[0]==d]
#                 model.Add(sum(y[(s_idx,q,t)] for q in range(Q) for t in slots_this_day) <= units*Q)  # looser

#     solver = cp_model.CpSolver()
#     solver.parameters.max_time_in_seconds = 25
#     solver.parameters.num_search_workers = 8

#     status = solver.Solve(model)
#     if status != cp_model.OPTIMAL and status != cp_model.FEASIBLE:
#         return jsonify({"error":"No feasible schedule found"}), 400

#     assignments = []
#     for s_idx, subj in enumerate(subjects):
#         for q in range(Q):
#             for t in range(T):
#                 if solver.Value(y[(s_idx,q,t)]) == 1:
#                     day_idx, slot_idx = slot_pairs[t]
#                     assignments.append({
#                         "subject_id": subj['id'],
#                         "section_index": q,
#                         "day": days[day_idx],
#                         "slot_index": slot_idx
#                     })

#     # Greedy assign room & instructor
#     room_occupied = set()
#     instr_occupied = set()
#     final = []
#     instr_iter = [inst['id'] for inst in instructors] if instructors else []

#     for a in assignments:
#         assigned_room = None
#         for r in rooms:
#             key = (r['id'], a['day'], a['slot_index'])
#             if key in room_occupied: continue
           
#             assigned_room = r['id']; room_occupied.add(key); break

#         assigned_instr = None
#         for inst_id in instr_iter:
#             keyi = (inst_id, a['day'], a['slot_index'])
#             if keyi in instr_occupied: continue
#             assigned_instr = inst_id; instr_occupied.add(keyi); break

#         final.append({
#             "subject_id": a['subject_id'],
#             "section_index": a['section_index'],
#             "day": a['day'],
#             "slot_index": a['slot_index'],
#             "room_id": assigned_room,
#             "instructor_id": assigned_instr
#         })

#     return jsonify({"assignments": final})

# if __name__ == '__main__':
#     app.run(host='0.0.0.0', port=5001, debug=True)


# scheduler-service/scheduler.py
# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from ortools.sat.python import cp_model
# import logging
# import random

# app = Flask(__name__)
# CORS(app)
# logging.basicConfig(level=logging.INFO)

# @app.route('/generate', methods=['POST'])
# def generate():
#     data = request.get_json()
#     if not data:
#         return jsonify({"error": "no payload"}), 400

#     subjects = data.get('subjects', [])
#     instructors = data.get('instructors', [])
#     rooms = data.get('rooms', [])
#     days = data.get('days', ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"])
#     slots_per_day = int(data.get('slotsPerDay', 8))
#     section_count = int(data.get('sectionCount', 1))

#     if not subjects or not rooms:
#         return jsonify({"error": "subjects and rooms required"}), 400

#     # Index sets
#     day_indices = list(range(len(days)))
#     slot_indices = list(range(slots_per_day))
#     slot_pairs = [(d, s) for d in day_indices for s in slot_indices]
#     T = len(slot_pairs)
#     S = len(subjects)
#     Q = section_count

#     # Build CP-SAT model
#     model = cp_model.CpModel()
#     y = {}

#     for s_idx in range(S):
#         for q in range(Q):
#             for t in range(T):
#                 y[(s_idx, q, t)] = model.NewBoolVar(f"y_s{s_idx}_q{q}_t{t}")

#     # Subject units (each subject gets 'units' slots)
#     for s_idx, subj in enumerate(subjects):
#         units = max(1, int(subj.get('units', 3)))
#         for q in range(Q):
#             model.Add(sum(y[(s_idx, q, t)] for t in range(T)) == units)
            

#     # No overlapping for same section
#     for q in range(Q):
#         for t in range(T):
#             model.Add(sum(y[(s_idx, q, t)] for s_idx in range(S)) <= 1)

#     # Distribution constraint: spread across days
#     for s_idx, subj in enumerate(subjects):
#         for q in range(Q):
#             for d in day_indices:
#                 # Limit max 2 slots of the same subject per day
#                 model.Add(sum(
#                     y[(s_idx, q, t)]
#                     for t, (day, slot) in enumerate(slot_pairs) if day == d
#                 ) <= 2)

#     # Solve
#     solver = cp_model.CpSolver()
#     solver.parameters.max_time_in_seconds = 20
#     solver.parameters.num_search_workers = 8

#     status = solver.Solve(model)
#     if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
#         return jsonify({"error": "No feasible schedule found"}), 400

#     # Collect assignments
#     assignments = []
#     for s_idx, subj in enumerate(subjects):
#         for q in range(Q):
#             for t in range(T):
#                 if solver.Value(y[(s_idx, q, t)]) == 1:
#                     day_idx, slot_idx = slot_pairs[t]
#                     assignments.append({
#                         "subject_id": subj['id'],
#                         "section_index": q,
#                         "day": days[day_idx],
#                         "slot_index": slot_idx
#                     })

#     # Greedy assign rooms & instructors
#     room_index = 0
#     instr_occupied = set()
#     final = []
#     instr_iter = [inst['id'] for inst in instructors] if instructors else []

#     # Shuffle rooms to avoid always picking the same one
#     random.shuffle(rooms)

#     for a in assignments:
#         # Assign room round-robin
#         assigned_room = rooms[room_index % len(rooms)]['id']
#         room_index += 1

#         # Assign instructor (avoid same slot conflicts)
#         assigned_instr = None
#         for inst_id in instr_iter:
#             keyi = (inst_id, a['day'], a['slot_index'])
#             if keyi not in instr_occupied:
#                 assigned_instr = inst_id
#                 instr_occupied.add(keyi)
#                 break

#         final.append({
#             "subject_id": a['subject_id'],
#             "section_index": a['section_index'],
#             "day": a['day'],
#             "slot_index": a['slot_index'],
#             "room_id": assigned_room,
#             "instructor_id": assigned_instr
#         })

#     return jsonify({"assignments": final})



# if __name__ == '__main__':
#     app.run(host='0.0.0.0', port=5001, debug=True)

#FUNCTIONAL
# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from ortools.sat.python import cp_model
# import logging
# import random

# app = Flask(__name__)
# CORS(app)
# logging.basicConfig(level=logging.INFO)

# @app.route('/generate', methods=['POST'])
# def generate():
#     data = request.get_json()
#     if not data:
#         return jsonify({"error": "no payload"}), 400

#     subjects = data.get('subjects', [])
#     instructors = data.get('instructors', [])
#     rooms = data.get('rooms', [])
#     days = data.get('days', ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"])
#     slots_per_day = int(data.get('slotsPerDay', 8))
#     section_count = int(data.get('sectionCount', 1))

#     if not subjects or not rooms:
#         return jsonify({"error": "subjects and rooms required"}), 400

#     # Index sets
#     day_indices = list(range(len(days)))
#     slot_indices = list(range(slots_per_day))
#     slot_pairs = [(d, s) for d in day_indices for s in slot_indices]
#     T = len(slot_pairs)
#     S = len(subjects)
#     Q = section_count

#     # Build CP-SAT model
#     model = cp_model.CpModel()
#     y = {}

#     for s_idx in range(S):
#         for q in range(Q):
#             for t in range(T):
#                 y[(s_idx, q, t)] = model.NewBoolVar(f"y_s{s_idx}_q{q}_t{t}")

#     # Assign subjects to sections (split evenly)
#     for s_idx, subj in enumerate(subjects):
#         units = max(1, int(subj.get('units', 3)))
#         assigned_section = s_idx % Q  # distribute subjects round-robin across sections
#         model.Add(sum(y[(s_idx, assigned_section, t)] for t in range(T)) == units)
#         # Ensure other sections do not get this subject
#         for q in range(Q):
#             if q != assigned_section:
#                 model.Add(sum(y[(s_idx, q, t)] for t in range(T)) == 0)

#     # No overlapping for same section
#     for q in range(Q):
#         for t in range(T):
#             model.Add(sum(y[(s_idx, q, t)] for s_idx in range(S)) <= 1)

#     # Distribution constraint: spread across days
#     for s_idx, subj in enumerate(subjects):
#         for q in range(Q):
#             for d in day_indices:
#                 model.Add(sum(
#                     y[(s_idx, q, t)]
#                     for t, (day, slot) in enumerate(slot_pairs) if day == d
#                 ) <= 2)

#     # Solve
#     solver = cp_model.CpSolver()
#     solver.parameters.max_time_in_seconds = 20
#     solver.parameters.num_search_workers = 8

#     status = solver.Solve(model)
#     if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
#         return jsonify({"error": "No feasible schedule found"}), 400

#     # Collect assignments
#     assignments = []
#     for s_idx, subj in enumerate(subjects):
#         for q in range(Q):
#             for t in range(T):
#                 if solver.Value(y[(s_idx, q, t)]) == 1:
#                     day_idx, slot_idx = slot_pairs[t]
#                     assignments.append({
#                         "subject_id": subj['id'],
#                         "section_index": q,
#                         "day": days[day_idx],
#                         "slot_index": slot_idx
#                     })

#     # Greedy assign rooms & instructors
#     room_index = 0
#     instr_occupied = set()
#     final = []
#     instr_iter = [inst['id'] for inst in instructors] if instructors else []

#     random.shuffle(rooms)  # shuffle to avoid always picking the same room

#     for a in assignments:
#         # Assign room round-robin
#         assigned_room = rooms[room_index % len(rooms)]['id']
#         room_index += 1

#         # Assign instructor (avoid same slot conflicts)
#         assigned_instr = None
#         for inst_id in instr_iter:
#             keyi = (inst_id, a['day'], a['slot_index'])
#             if keyi not in instr_occupied:
#                 assigned_instr = inst_id
#                 instr_occupied.add(keyi)
#                 break

#         final.append({
#             "subject_id": a['subject_id'],
#             "section_index": a['section_index'],
#             "day": a['day'],
#             "slot_index": a['slot_index'],
#             "room_id": assigned_room,
#             "instructor_id": assigned_instr
#         })

#     return jsonify({"assignments": final})


# if __name__ == '__main__':
#     app.run(host='0.0.0.0', port=5001, debug=True)

# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from ortools.sat.python import cp_model
# import logging
# import random

# app = Flask(__name__)
# CORS(app)
# logging.basicConfig(level=logging.INFO)

# @app.route('/generate', methods=['POST'])
# def generate():
#     data = request.get_json()
#     if not data:
#         return jsonify({"error": "no payload"}), 400

#     subjects = data.get('subjects', [])
#     instructors = data.get('instructors', [])
#     rooms = data.get('rooms', [])
#     days = data.get('days', ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"])
#     slots_per_day = int(data.get('slotsPerDay', 8))
#     section_count = int(data.get('sectionCount', 1))

#     if not subjects or not rooms:
#         return jsonify({"error": "subjects and rooms required"}), 400

#     # Index sets
#     day_indices = list(range(len(days)))
#     slot_indices = list(range(slots_per_day))
#     slot_pairs = [(d, s) for d in day_indices for s in slot_indices]
#     T = len(slot_pairs)
#     S = len(subjects)
#     Q = section_count

#     # Build CP-SAT model
#     model = cp_model.CpModel()
#     y = {}
#     for s_idx in range(S):
#         for q in range(Q):
#             for t in range(T):
#                 y[(s_idx, q, t)] = model.NewBoolVar(f"y_s{s_idx}_q{q}_t{t}")

#     # Assign subjects to sections (split evenly)
#     for s_idx, subj in enumerate(subjects):
#         units = max(1, int(subj.get('units', 3)))
#         assigned_section = s_idx % Q  # distribute subjects round-robin across sections
#         model.Add(sum(y[(s_idx, assigned_section, t)] for t in range(T)) == units)

#         # Ensure other sections do not get this subject
#         for q in range(Q):
#             if q != assigned_section:
#                 model.Add(sum(y[(s_idx, q, t)] for t in range(T)) == 0)

#     # No overlapping for same section
#     for q in range(Q):
#         for t in range(T):
#             model.Add(sum(y[(s_idx, q, t)] for s_idx in range(S)) <= 1)

#     # Distribution constraint: spread across days
#     for s_idx, subj in enumerate(subjects):
#         for q in range(Q):
#             for d in day_indices:
#                 model.Add(sum(
#                     y[(s_idx, q, t)]
#                     for t, (day, slot) in enumerate(slot_pairs)
#                     if day == d
#                 ) <= 2)

#     # Solve
#     solver = cp_model.CpSolver()
#     solver.parameters.max_time_in_seconds = 20
#     solver.parameters.num_search_workers = 8
#     status = solver.Solve(model)

#     if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
#         return jsonify({"error": "No feasible schedule found"}), 400

#     # Collect assignments
#     assignments = []
#     for s_idx, subj in enumerate(subjects):
#         for q in range(Q):
#             for t in range(T):
#                 if solver.Value(y[(s_idx, q, t)]) == 1:
#                     day_idx, slot_idx = slot_pairs[t]
#                     assignments.append({
#                         "subject_id": subj['id'],
#                         "section_index": q,
#                         "day": days[day_idx],
#                         "slot_index": slot_idx
#                     })

#     # Greedy assign rooms & instructors
#     room_index = 0
#     instr_occupied = set()
#     final = []
#     instr_iter = [inst['id'] for inst in instructors] if instructors else []
#     random.shuffle(rooms)  # shuffle to avoid always picking the same room

#     for a in assignments:
#         # Assign room round-robin
#         assigned_room = rooms[room_index % len(rooms)]['id']
#         room_index += 1

#         # Assign instructor (avoid same slot conflicts)
#         assigned_instr = None
#         for inst_id in instr_iter:
#             keyi = (inst_id, a['day'], a['slot_index'])
#             if keyi not in instr_occupied:
#                 assigned_instr = inst_id
#                 instr_occupied.add(keyi)
#                 break

#         final.append({
#             "subject_id": a['subject_id'],
#             "section_index": a['section_index'],
#             "day": a['day'],
#             "slot_index": a['slot_index'],
#             "room_id": assigned_room,
#             "instructor_id": assigned_instr
#         })

#     return jsonify({"assignments": final})

# if __name__ == '__main__':
#     app.run(host='0.0.0.0', port=5001, debug=True)


#NEW FUNCTIONAL
# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from ortools.sat.python import cp_model
# import logging

# app = Flask(__name__)
# CORS(app)
# logging.basicConfig(level=logging.INFO)

# @app.route('/generate', methods=['POST'])
# def generate():
#     data = request.get_json()
#     if not data:
#         return jsonify({"error": "No payload provided"}), 400

#     # Extract data
#     subjects = data.get('subjects', [])
#     instructors = data.get('instructors', [])
#     rooms = data.get('rooms', [])
#     days = data.get('days', ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"])
#     slots_per_day = int(data.get('slotsPerDay', 12))  # 7 AM - 7 PM = 12 hours
#     section_count = int(data.get('sectionCount', 1))

#     # Validation
#     if not subjects or not rooms:
#         return jsonify({"error": "Subjects and rooms are required"}), 400
    
#     if not instructors:
#         return jsonify({"error": "At least one instructor is required"}), 400

#     logging.info(f"📊 Generating schedule: {len(subjects)} subjects, {len(instructors)} instructors, {len(rooms)} rooms, {section_count} sections")

#     # Index sets
#     S = len(subjects)  # Number of subjects
#     I = len(instructors)  # Number of instructors
#     R = len(rooms)  # Number of rooms
#     D = len(days)  # Number of days
#     T = slots_per_day  # Time slots per day
#     Q = section_count  # Number of sections

#     # Create CP-SAT model
#     model = cp_model.CpModel()

#     # Decision variables: x[s, q, i, r, d, t] = 1 if subject s in section q is taught by instructor i in room r on day d at time t
#     x = {}
#     for s in range(S):
#         for q in range(Q):
#             for i in range(I):
#                 for r in range(R):
#                     for d in range(D):
#                         for t in range(T):
#                             x[(s, q, i, r, d, t)] = model.NewBoolVar(f'x_s{s}_q{q}_i{i}_r{r}_d{d}_t{t}')

#     # ==================== CONSTRAINTS ====================

#     # 1. Each subject must be assigned exactly 'units' times per section
#     for s, subj in enumerate(subjects):
#         units = max(1, int(subj.get('units', 3)))
#         for q in range(Q):
#             model.Add(
#                 sum(x[(s, q, i, r, d, t)] 
#                     for i in range(I) 
#                     for r in range(R) 
#                     for d in range(D) 
#                     for t in range(T)) == units
#             )

#     # 2. Each section can have at most one subject at any given time
#     for q in range(Q):
#         for d in range(D):
#             for t in range(T):
#                 model.Add(
#                     sum(x[(s, q, i, r, d, t)] 
#                         for s in range(S) 
#                         for i in range(I) 
#                         for r in range(R)) <= 1
#                 )

#     # 3. Each instructor can teach at most one class at any given time
#     for i in range(I):
#         for d in range(D):
#             for t in range(T):
#                 model.Add(
#                     sum(x[(s, q, i, r, d, t)] 
#                         for s in range(S) 
#                         for q in range(Q) 
#                         for r in range(R)) <= 1
#                 )

#     # 4. Each room can be used by at most one class at any given time
#     for r in range(R):
#         for d in range(D):
#             for t in range(T):
#                 model.Add(
#                     sum(x[(s, q, i, r, d, t)] 
#                         for s in range(S) 
#                         for q in range(Q) 
#                         for i in range(I)) <= 1
#                 )

#     # 5. Distribute classes across different days (avoid clustering)
#     for s in range(S):
#         for q in range(Q):
#             for d in range(D):
#                 model.Add(
#                     sum(x[(s, q, i, r, d, t)] 
#                         for i in range(I) 
#                         for r in range(R) 
#                         for t in range(T)) <= 2  # Max 2 sessions per day for same subject
#                 )

#     # 6. Same subject in same section should have same instructor (consistency)
#     # Create auxiliary variables for instructor assignment per subject-section pair
#     y = {}  # y[(s, q, i)] = 1 if instructor i teaches subject s in section q
#     for s in range(S):
#         for q in range(Q):
#             for i in range(I):
#                 y[(s, q, i)] = model.NewBoolVar(f'y_s{s}_q{q}_i{i}')
#                 # If instructor i teaches subject s in section q, then y = 1
#                 for d in range(D):
#                     for t in range(T):
#                         for r in range(R):
#                             model.Add(y[(s, q, i)] >= x[(s, q, i, r, d, t)])
    
#     # Each subject-section pair should have exactly one instructor
#     for s in range(S):
#         for q in range(Q):
#             model.Add(sum(y[(s, q, i)] for i in range(I)) == 1)
#             # If y[(s,q,i)] = 0, then no assignment for that instructor
#             for i in range(I):
#                 model.Add(
#                     sum(x[(s, q, i, r, d, t)] 
#                         for r in range(R) 
#                         for d in range(D) 
#                         for t in range(T)) <= 
#                     y[(s, q, i)] * subjects[s].get('units', 3) * 10  # Large number
#                 )

#     # 7. Avoid back-to-back classes for same instructor (optional, for better scheduling)
#     for i in range(I):
#         for d in range(D):
#             for t in range(T - 1):  # Check consecutive slots
#                 # If instructor has class at time t, try to avoid t+1 (soft constraint via objective)
#                 pass  # Will handle in objective

#     # ==================== OBJECTIVE ====================
#     # Minimize total "cost" - prefer compact schedules
#     objective_terms = []
    
#     # Prefer earlier time slots
#     for s in range(S):
#         for q in range(Q):
#             for i in range(I):
#                 for r in range(R):
#                     for d in range(D):
#                         for t in range(T):
#                             objective_terms.append(x[(s, q, i, r, d, t)] * (t + d * T))
    
#     model.Minimize(sum(objective_terms))

#     # ==================== SOLVE ====================
#     solver = cp_model.CpSolver()
#     solver.parameters.max_time_in_seconds = 30
#     solver.parameters.num_search_workers = 8
#     solver.parameters.log_search_progress = True

#     logging.info("🔧 Starting solver...")
#     status = solver.Solve(model)

#     if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
#         logging.error(f"❌ No feasible solution found. Status: {solver.StatusName(status)}")
#         return jsonify({
#             "error": "No feasible schedule found", 
#             "detail": "Try reducing subjects, increasing sections, or adding more instructors/rooms"
#         }), 400

#     logging.info(f"✅ Solution found! Status: {solver.StatusName(status)}")

#     # ==================== EXTRACT SOLUTION ====================
#     assignments = []
#     for s in range(S):
#         for q in range(Q):
#             for i in range(I):
#                 for r in range(R):
#                     for d in range(D):
#                         for t in range(T):
#                             if solver.Value(x[(s, q, i, r, d, t)]) == 1:
#                                 assignments.append({
#                                     "subject_id": subjects[s]['id'],
#                                     "section_index": q,
#                                     "instructor_id": instructors[i]['id'],
#                                     "room_id": rooms[r]['id'],
#                                     "day": days[d],
#                                     "slot_index": t
#                                 })

#     logging.info(f"📋 Generated {len(assignments)} assignments")

#     # Verify no conflicts
#     verify_conflicts(assignments)

#     return jsonify({"assignments": assignments, "status": solver.StatusName(status)})


# def verify_conflicts(assignments):
#     """Verify that there are no scheduling conflicts"""
    
#     # Check room conflicts
#     room_schedule = {}
#     for a in assignments:
#         key = (a['room_id'], a['day'], a['slot_index'])
#         if key in room_schedule:
#             logging.warning(f"⚠️ ROOM CONFLICT: Room {a['room_id']} on {a['day']} slot {a['slot_index']}")
#         room_schedule[key] = a

#     # Check instructor conflicts
#     instr_schedule = {}
#     for a in assignments:
#         key = (a['instructor_id'], a['day'], a['slot_index'])
#         if key in instr_schedule:
#             logging.warning(f"⚠️ INSTRUCTOR CONFLICT: Instructor {a['instructor_id']} on {a['day']} slot {a['slot_index']}")
#         instr_schedule[key] = a

#     # Check section conflicts
#     section_schedule = {}
#     for a in assignments:
#         key = (a['section_index'], a['day'], a['slot_index'])
#         if key in section_schedule:
#             logging.warning(f"⚠️ SECTION CONFLICT: Section {a['section_index']} on {a['day']} slot {a['slot_index']}")
#         section_schedule[key] = a

#     logging.info("✅ Conflict verification complete")


# if __name__ == '__main__':
#     app.run(host='0.0.0.0', port=5001, debug=True)

from flask import Flask, request, jsonify
from flask_cors import CORS
from ortools.sat.python import cp_model
import logging

app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)

def time_to_hour(time_str):
    """Convert time string HH:MM:SS to hour integer"""
    try:
        return int(time_str.split(':')[0])
    except:
        return 0

def is_instructor_available(instructor, day, slot_index):
    """Check if instructor is available for a specific day and time slot"""
    availability = instructor.get('availability', [])
    
    if not availability:
        return True  # If no availability data, assume available
    
    # Slot index 0 = 7-8 AM, 1 = 8-9 AM, etc.
    slot_start_hour = 7 + slot_index
    slot_end_hour = slot_start_hour + 1
    
    # Check if this day/time falls within any availability window
    for avail in availability:
        if avail.get('day') != day:
            continue
            
        avail_start = time_to_hour(avail.get('start_time', '00:00:00'))
        avail_end = time_to_hour(avail.get('end_time', '23:59:59'))
        
        # Check if slot falls completely within availability window
        if slot_start_hour >= avail_start and slot_end_hour <= avail_end:
            return True
    
    return False

@app.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No payload provided"}), 400

    subjects = data.get('subjects', [])
    instructors = data.get('instructors', [])
    rooms = data.get('rooms', [])
    days = data.get('days', ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"])
    slots_per_day = int(data.get('slotsPerDay', 12))
    section_count = int(data.get('sectionCount', 1))
    consider_availability = data.get('considerInstructorAvailability', True)

    if not subjects or not rooms:
        return jsonify({"error": "Subjects and rooms are required"}), 400
    
    if not instructors:
        return jsonify({"error": "At least one instructor is required"}), 400

    logging.info(f"📊 Generating schedule: {len(subjects)} subjects, {len(instructors)} instructors, {len(rooms)} rooms, {section_count} sections")
    logging.info(f"🔍 Consider Availability: {consider_availability}")

    # Filter to available instructors (already done in Node.js, but verify)
    if consider_availability:
        available_instructors = [i for i in instructors if i.get('available', True)]
        if not available_instructors:
            return jsonify({
                "error": "No available instructors",
                "detail": "No instructors are marked as available."
            }), 400
        instructors = available_instructors
        logging.info(f"✅ Using {len(instructors)} available instructors")

    S = len(subjects)
    I = len(instructors)
    R = len(rooms)
    D = len(days)
    T = slots_per_day
    Q = section_count

    model = cp_model.CpModel()

    # Decision variables: x[s, q, i, r, d, t] = 1 if subject s in section q 
    # is taught by instructor i in room r on day d at time t
    x = {}
    for s in range(S):
        for q in range(Q):
            for i in range(I):
                for r in range(R):
                    for d in range(D):
                        for t in range(T):
                            # Only create variable if instructor is available at this time
                            if consider_availability:
                                if not is_instructor_available(instructors[i], days[d], t):
                                    continue  # Skip creating variable for unavailable slots
                            
                            x[(s, q, i, r, d, t)] = model.NewBoolVar(f'x_s{s}_q{q}_i{i}_r{r}_d{d}_t{t}')

    logging.info(f"📦 Created {len(x)} decision variables")

    # ==================== CONSTRAINTS ====================

    # 1. Each subject must be assigned exactly 'units' times per section
    for s, subj in enumerate(subjects):
        units = max(1, int(subj.get('units', 3)))
        for q in range(Q):
            valid_assignments = []
            for i in range(I):
                for r in range(R):
                    for d in range(D):
                        for t in range(T):
                            if (s, q, i, r, d, t) in x:
                                valid_assignments.append(x[(s, q, i, r, d, t)])
            
            if valid_assignments:
                model.Add(sum(valid_assignments) == units)
            else:
                logging.warning(f"⚠️ No valid assignments possible for subject {subj.get('code')} in section {q}")

    # 2. Each section can have at most one subject at any given time
    for q in range(Q):
        for d in range(D):
            for t in range(T):
                assignments = []
                for s in range(S):
                    for i in range(I):
                        for r in range(R):
                            if (s, q, i, r, d, t) in x:
                                assignments.append(x[(s, q, i, r, d, t)])
                if assignments:
                    model.Add(sum(assignments) <= 1)

    # 3. Each instructor can teach at most one class at any given time
    for i in range(I):
        for d in range(D):
            for t in range(T):
                assignments = []
                for s in range(S):
                    for q in range(Q):
                        for r in range(R):
                            if (s, q, i, r, d, t) in x:
                                assignments.append(x[(s, q, i, r, d, t)])
                if assignments:
                    model.Add(sum(assignments) <= 1)

    # 4. Each room can be used by at most one class at any given time
    for r in range(R):
        for d in range(D):
            for t in range(T):
                assignments = []
                for s in range(S):
                    for q in range(Q):
                        for i in range(I):
                            if (s, q, i, r, d, t) in x:
                                assignments.append(x[(s, q, i, r, d, t)])
                if assignments:
                    model.Add(sum(assignments) <= 1)

    # 5. Distribute classes across different days (max 2 sessions per day for same subject)
    for s in range(S):
        for q in range(Q):
            for d in range(D):
                assignments = []
                for i in range(I):
                    for r in range(R):
                        for t in range(T):
                            if (s, q, i, r, d, t) in x:
                                assignments.append(x[(s, q, i, r, d, t)])
                if assignments:
                    model.Add(sum(assignments) <= 2)

    # 6. Same subject in same section should have same instructor (consistency)
    y = {}  # y[(s, q, i)] = 1 if instructor i teaches subject s in section q
    for s in range(S):
        for q in range(Q):
            for i in range(I):
                # Check if this instructor has any valid slots for this subject/section
                has_valid_slots = any(
                    (s, q, i, r, d, t) in x
                    for r in range(R)
                    for d in range(D)
                    for t in range(T)
                )
                
                if has_valid_slots:
                    y[(s, q, i)] = model.NewBoolVar(f'y_s{s}_q{q}_i{i}')
                    
                    # If y = 1, then at least one x must be 1
                    for d in range(D):
                        for t in range(T):
                            for r in range(R):
                                if (s, q, i, r, d, t) in x:
                                    model.Add(y[(s, q, i)] >= x[(s, q, i, r, d, t)])
    
    # Each subject-section pair should have exactly one instructor
    for s in range(S):
        for q in range(Q):
            instructors_available = [y[(s, q, i)] for i in range(I) if (s, q, i) in y]
            if instructors_available:
                model.Add(sum(instructors_available) == 1)
            else:
                logging.warning(f"⚠️ No instructors available for subject {subjects[s].get('code')} section {q}")

    # ==================== OBJECTIVE ====================
    # Minimize total "cost" - prefer earlier time slots and compact schedules
    objective_terms = []
    for key, var in x.items():
        s, q, i, r, d, t = key
        # Prefer earlier times and earlier days
        cost = t + (d * T)
        objective_terms.append(var * cost)
    
    if objective_terms:
        model.Minimize(sum(objective_terms))
    else:
        logging.warning("⚠️ No objective terms - this may indicate availability constraints are too strict")

    # ==================== SOLVE ====================
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30
    solver.parameters.num_search_workers = 8
    solver.parameters.log_search_progress = True

    logging.info("🚀 Starting solver...")
    status = solver.Solve(model)

    if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        logging.error(f"❌ No feasible solution found. Status: {solver.StatusName(status)}")
        return jsonify({
            "error": "No feasible schedule found", 
            "detail": "Try reducing subjects, increasing sections, adding more instructors/rooms, relaxing availability constraints, or adding more availability time slots."
        }), 400

    logging.info(f"✅ Solution found! Status: {solver.StatusName(status)}")

    # ==================== EXTRACT SOLUTION ====================
    assignments = []
    for key, var in x.items():
        if solver.Value(var) == 1:
            s, q, i, r, d, t = key
            assignments.append({
                "subject_id": subjects[s]['id'],
                "section_index": q,
                "instructor_id": instructors[i]['id'],
                "room_id": rooms[r]['id'],
                "day": days[d],
                "slot_index": t
            })

    logging.info(f"📋 Generated {len(assignments)} assignments")
    
    # Verify assignments
    verify_conflicts(assignments)
    
    # Verify availability constraints were respected
    if consider_availability:
        verify_availability_compliance(assignments, instructors, days)

    return jsonify({
        "assignments": assignments, 
        "status": solver.StatusName(status),
        "consideredAvailability": consider_availability,
        "totalVariables": len(x),
        "totalAssignments": len(assignments)
    })


def verify_conflicts(assignments):
    """Verify that there are no scheduling conflicts"""
    room_schedule = {}
    instr_schedule = {}
    section_schedule = {}
    
    conflicts_found = False
    
    for a in assignments:
        # Check room conflicts
        key = (a['room_id'], a['day'], a['slot_index'])
        if key in room_schedule:
            logging.warning(f"⚠️ ROOM CONFLICT: Room {a['room_id']} on {a['day']} slot {a['slot_index']}")
            conflicts_found = True
        room_schedule[key] = a

        # Check instructor conflicts
        key = (a['instructor_id'], a['day'], a['slot_index'])
        if key in instr_schedule:
            logging.warning(f"⚠️ INSTRUCTOR CONFLICT: Instructor {a['instructor_id']} on {a['day']} slot {a['slot_index']}")
            conflicts_found = True
        instr_schedule[key] = a

        # Check section conflicts
        key = (a['section_index'], a['day'], a['slot_index'])
        if key in section_schedule:
            logging.warning(f"⚠️ SECTION CONFLICT: Section {a['section_index']} on {a['day']} slot {a['slot_index']}")
            conflicts_found = True
        section_schedule[key] = a

    if conflicts_found:
        logging.error("❌ Conflicts detected in schedule!")
    else:
        logging.info("✅ No conflicts detected")


def verify_availability_compliance(assignments, instructors, days):
    """Verify that all assignments respect instructor availability constraints"""
    violations = 0
    
    # Create instructor lookup by ID
    instructor_map = {i['id']: i for i in instructors}
    
    for a in assignments:
        instructor = instructor_map.get(a['instructor_id'])
        if not instructor:
            continue
            
        if not is_instructor_available(instructor, a['day'], a['slot_index']):
            logging.warning(f"⚠️ AVAILABILITY VIOLATION: Instructor {a['instructor_id']} scheduled on {a['day']} slot {a['slot_index']} but not available")
            violations += 1
    
    if violations > 0:
        logging.error(f"❌ {violations} availability constraint violations detected!")
    else:
        logging.info("✅ All assignments respect instructor availability")


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)