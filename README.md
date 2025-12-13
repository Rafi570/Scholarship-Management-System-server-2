# ⚙️ Scholarship Management System - Server Side (Backend)

This repository contains the backend logic, API, and database interaction layer for the Scholarship Management System. It serves all necessary data to the frontend application and manages user applications, payments, and administrative operations.

---

## 🌐 API Base URL
https://scholarship-management-system-serve-one.vercel.app

---

## 🛠️ Technologies Used

- **Runtime Environment:** Node.js  
- **Web Framework:** Express.js  
- **Database:** MongoDB (using Mongoose)  
- **Payment Gateway Integration:** Stripe  
- **Authentication:** JWT (JSON Web Tokens)  
- **Deployment:** Vercel _(or add your method)_

---

## ✨ Key Features

- **RESTful APIs** for Scholarships, Applications, Reviews, Users.
- **Role-Based Access Control (RBAC)** for Admin, Moderator, Student.
- **Stripe Payment Integration** for secure transactions.
- **Full CRUD Operations** for scholarships, users, applications.
- **JWT-based Authentication & Authorization** for secure access.

---

## ⚙️ Local Setup Guide

### **1. Clone the Repository**

```bash
git clone <Your-Server-Repository-URL>
cd server

```
### **2. Install Dependencies
```bash
npm install
```
###**3. Setup Environment Variables
```bash
# .env

PORT=3000
NODE_ENV=development

# Database Configuration
DB_USER=<Your_DB_User>
DB_PASS=<Your_DB_Password>
DB_HOST=<Your_DB_Host>
DATABASE_URL=mongodb+srv://${DB_USER}:${DB_PASS}@${DB_HOST}/<DatabaseName>?retryWrites=true&w=majority

# JWT Security
ACCESS_TOKEN_SECRET=<A_Very_Long_Random_String>

# Stripe Payment
STRIPE_SECRET_KEY=<Your_Stripe_Secret_Key>

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:5173


```
### **4. Start the Server
```bash
nodemon index.js
```
