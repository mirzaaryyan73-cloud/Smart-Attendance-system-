SMART ATTENDANCE SYSTEM - C++ CONSOLE PROJECT

REQUIREMENTS
- C++ compiler (g++, Code::Blocks, Dev-C++, or Visual Studio).

RUN WITH G++
1. Open terminal in this folder.
2. Compile:
   g++ SmartAttendance.cpp -o SmartAttendance
3. Run:
   Windows: SmartAttendance.exe
   Linux/macOS: ./SmartAttendance

FEATURES
1. Add student
2. Update student name
3. Mark daily attendance for all students (P/A)
4. Display total classes, attended classes and percentage
5. Delete student
6. Save and exit

DATA STORAGE
- Records are saved in students.txt in the same working folder.
- Format: rollNo,name,totalClasses,attendedClasses
- The file is loaded automatically when the program starts.
- Duplicate roll numbers are rejected.

NOTE
This C++ console version is separate from the QR web application.
It uses a simple cumulative attendance count and does not use QR codes or a database.
