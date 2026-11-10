#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <iomanip>
#include <sstream>
using namespace std;

struct Student {
    int rollNo;
    string name;
    int totalClasses;
    int attendedClasses;

    double getAttendancePercentage() const {
        if (totalClasses == 0) return 0.0;
        return (static_cast<double>(attendedClasses) / totalClasses) * 100.0;
    }
};

const string FILE_NAME = "students.txt";
vector<Student> students;

// Read saved student records when program starts.
void loadStudents() {
    students.clear();
    ifstream file(FILE_NAME);
    string line;
    while (getline(file, line)) {
        stringstream ss(line);
        Student s;
        string roll, total, attended;
        if (getline(ss, roll, ',') &&
            getline(ss, s.name, ',') &&
            getline(ss, total, ',') &&
            getline(ss, attended, ',')) {
            try {
                s.rollNo = stoi(roll);
                s.totalClasses = stoi(total);
                s.attendedClasses = stoi(attended);
                students.push_back(s);
            } catch (...) {
                // Ignore an invalid/corrupted line.
            }
        }
    }
    file.close();
}

// Save all records in a simple CSV-like text file.
void saveStudents() {
    ofstream file(FILE_NAME);
    for (const Student& s : students) {
        file << s.rollNo << "," << s.name << ","
             << s.totalClasses << "," << s.attendedClasses << "\n";
    }
    file.close();
}

int findStudent(int rollNo) {
    for (int i = 0; i < static_cast<int>(students.size()); i++) {
        if (students[i].rollNo == rollNo) return i;
    }
    return -1;
}

void addStudent() {
    Student s;
    cout << "\nEnter roll number: ";
    cin >> s.rollNo;

    if (findStudent(s.rollNo) != -1) {
        cout << "This roll number already exists.\n";
        return;
    }

    cin.ignore();
    cout << "Enter student name: ";
    getline(cin, s.name);

    s.totalClasses = 0;
    s.attendedClasses = 0;
    students.push_back(s);
    saveStudents();
    cout << "Student added successfully.\n";
}

void updateStudent() {
    int rollNo;
    cout << "\nEnter roll number to update: ";
    cin >> rollNo;

    int index = findStudent(rollNo);
    if (index == -1) {
        cout << "Student not found.\n";
        return;
    }

    cin.ignore();
    cout << "Enter new name: ";
    getline(cin, students[index].name);
    saveStudents();
    cout << "Student information updated.\n";
}

void markAttendance() {
    if (students.empty()) {
        cout << "\nNo students available. Add students first.\n";
        return;
    }

    cout << "\nEnter attendance for each student:\n";
    cout << "P = Present, A = Absent\n";

    for (Student& s : students) {
        char status;
        cout << s.rollNo << " - " << s.name << " (P/A): ";
        cin >> status;

        // Keep asking until the user enters a valid status.
        while (status != 'P' && status != 'p' &&
               status != 'A' && status != 'a') {
            cout << "Please enter P or A: ";
            cin >> status;
        }

        s.totalClasses++;
        if (status == 'P' || status == 'p') {
            s.attendedClasses++;
        }
    }

    saveStudents();
    cout << "Today's attendance saved.\n";
}

void displayStudents() {
    if (students.empty()) {
        cout << "\nNo student records found.\n";
        return;
    }

    cout << "\n";
    cout << left << setw(12) << "Roll No"
         << setw(28) << "Student Name"
         << setw(15) << "Total Classes"
         << setw(18) << "Attended"
         << setw(12) << "Percentage" << "\n";
    cout << string(85, '-') << "\n";

    for (const Student& s : students) {
        cout << left << setw(12) << s.rollNo
             << setw(28) << s.name
             << setw(15) << s.totalClasses
             << setw(18) << s.attendedClasses
             << fixed << setprecision(2)
             << s.getAttendancePercentage() << "%\n";
    }
}

void deleteStudent() {
    int rollNo;
    cout << "\nEnter roll number to delete: ";
    cin >> rollNo;

    int index = findStudent(rollNo);
    if (index == -1) {
        cout << "Student not found.\n";
        return;
    }

    students.erase(students.begin() + index);
    saveStudents();
    cout << "Student deleted successfully.\n";
}

int main() {
    loadStudents();

    int choice;
    do {
        cout << "\n========== SMART ATTENDANCE SYSTEM ==========\n";
        cout << "1. Add Student\n";
        cout << "2. Update Student Name\n";
        cout << "3. Mark Daily Attendance\n";
        cout << "4. Display Student Records\n";
        cout << "5. Delete Student\n";
        cout << "6. Save and Exit\n";
        cout << "Enter your choice: ";
        cin >> choice;

        switch (choice) {
            case 1: addStudent(); break;
            case 2: updateStudent(); break;
            case 3: markAttendance(); break;
            case 4: displayStudents(); break;
            case 5: deleteStudent(); break;
            case 6:
                saveStudents();
                cout << "Records saved. Goodbye!\n";
                break;
            default:
                cout << "Invalid choice. Try again.\n";
        }
    } while (choice != 6);

    return 0;
}
