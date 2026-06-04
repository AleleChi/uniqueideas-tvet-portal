# IDEAS-TVET Beneficiary Management Platform

## Overview

The IDEAS-TVET Beneficiary Management Platform is a full-stack training management system developed for the administration, monitoring, documentation, admission processing, and lifecycle management of beneficiaries enrolled in the IDEAS-TVET Skills Development Programme.

The platform enables Training Service Providers (TSPs) to manage trainee records, capture photographs, generate admission documents, track beneficiary progress, manage attendance, monitor document submissions, and maintain a complete audit trail throughout the training lifecycle.

This implementation has been customized for:

**Training Service Provider (TSP):**

Unique Technology Nig. Ltd

**Training Location:**

Owerri, Imo State, Nigeria

**Skill Sector:**

Computer Hardware and Cell Phone Repairs

---

# Core Features

## Beneficiary Management

Manage trainee information including:

* First Name
* Last Name
* Other Names
* Gender
* Date of Birth
* Phone Number
* Email Address
* NIN
* BVN
* State
* City
* Residential Address
* Registration Date
* Beneficiary Status

---

## Dynamic Custom Fields

Administrators can create additional fields without modifying source code.

Examples:

* Educational Qualification
* Emergency Contact
* Guardian Information
* Medical Information
* Training Experience
* Prior Skills

---

## Photo Capture & Management

Supports:

* Webcam Capture
* Device Camera Capture
* Image Upload
* Image Preview
* Image Replacement

Captured photographs are linked directly to beneficiary records.

---

## Beneficiary Profile Workspace

Each beneficiary has a dedicated workspace containing:

### Overview

Displays:

* Personal Information
* Contact Information
* Location Details
* Registration Information
* Progress Overview

---

### Admission

Functions:

* Generate Admission Letter
* Preview Admission Letter
* Download Admission Letter
* Print Admission Letter
* Send Admission Email
* Resend Admission Email
* Copy Secure Response Link

---

### Acceptance

Supports:

* Acceptance Status Tracking
* Acceptance Document Upload
* Electronic Signature
* Manual Verification Workflow

---

### Forms

Manages:

* Admission Forms
* Registration Forms
* Additional Intake Forms

Features:

* Save Draft
* Submit
* Print
* Download

---

### Documents

Centralized document repository.

Supported files include:

* Passport Photograph
* NIN Document
* BVN Document
* Admission Letter
* Acceptance Letter
* Certificates
* Additional Attachments

Functions:

* Upload
* Preview
* Download
* Delete
* Version Tracking

---

### Training

Training management features include:

* Attendance Tracking
* Daily Logs
* Hours Tracking
* Progress Monitoring
* Completion Verification

---

### Audit Logs

Tracks:

* Record Updates
* Document Uploads
* Admission Activities
* Email Activities
* User Actions
* System Events

---

# Admission Workflow

## Step 1

Administrator creates beneficiary profile.

## Step 2

Administrator generates admission package.

## Step 3

Admission package is emailed to beneficiary.

## Step 4

Beneficiary accesses secure response portal.

## Step 5

Beneficiary:

* Downloads documents
* Completes forms
* Uploads acceptance documents
* Signs electronically

## Step 6

Administrator reviews submissions.

## Step 7

Beneficiary is marked:

* Accepted
* Enrolled
* Completed

---

# Export Features

## Excel Export

Supports export of beneficiary data.

Columns include:

* Photo
* First Name
* Last Name
* NIN
* BVN
* State
* City
* TSP
* Skill Sector
* Registration Date

---

## PDF Export

Produces professional beneficiary album exports containing:

* Beneficiary Photograph
* Beneficiary Information
* Programme Information
* Training Details

---

# Public Response Portal

A secure public-facing portal allows beneficiaries to respond without creating accounts.

Features:

* Secure Token Access
* Document Downloads
* Form Completion
* Acceptance Submission
* Electronic Signature

---

# Email System

Supports:

* Admission Letter Dispatch
* Acceptance Notifications
* Status Updates
* Resend Functionality

Sender Account:

[uniqueideasproject@gmail.com](mailto:uniqueideasproject@gmail.com)

---

# Technology Stack

## Frontend

* React
* Vite
* TypeScript
* TailwindCSS
* Zustand
* Axios

---

## Backend

* NestJS
* Node.js
* TypeScript

---

## Database

### Production

PostgreSQL

Hosted on Neon

### Development Fallback

JSON Storage Engine

database_ideas_tvet.json

---

## Cloud Storage

Cloudinary

Used for:

* Beneficiary Photos
* Generated Documents
* Uploads
* Certificates

---

## Email Service

SMTP

Current Provider:

Gmail SMTP

Future Providers:

* Resend
* SendGrid
* Brevo

---

# Database Tables

## beneficiaries

Stores beneficiary profiles.

## admissions

Stores admission lifecycle information.

## acceptance_letters

Stores acceptance responses.

## documents

Stores uploaded files and generated documents.

## attendance_logs

Stores attendance records.

## audit_logs

Stores audit history.

## email_logs

Stores email delivery history.

## public_response_tokens

Stores secure response links.

## custom_fields

Stores dynamic registration fields.

---

# Environment Variables

Required configuration:

```env
DATABASE_URL=

SMTP_USER=
SMTP_PASS=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

APP_URL=
JWT_SECRET=
```

# Installation

## Clone Repository

```bash
git clone <repository-url>
```

## Install Dependencies

```bash
npm install
```

## Configure Environment

Create:

```env
.env
```

and populate required variables.

## Run Development

```bash
npm run dev
```

## Build Production

```bash
npm run build
```

## Start Production

```bash
npm run start
```

# Deployment

Recommended Infrastructure:

Frontend:
Vercel

Backend:
Render

Database:
Neon PostgreSQL

Storage:
Cloudinary

Email:
Gmail SMTP / Resend

---

# Security Features

* Secure Response Tokens
* Audit Logging
* Soft Deletes
* Role-Based Administration
* Document Verification
* Email Tracking
* Database Persistence
* Secure Cloud Storage

---

# Future Enhancements

* Bulk Admission Dispatch
* WhatsApp Notifications
* SMS Notifications
* Certificate Generation
* QR Code Verification
* Advanced Analytics Dashboard
* Multi-Tenant Support
* Biometric Integration
* Attendance QR Scanning
* Mobile Application

---

# Developed For

IDEAS-TVET Skills Development Programme

Training Service Provider:

Unique Technology Nig. Ltd

Location:

Owerri, Imo State, Nigeria

Skill Sector:

Computer Hardware and Cell Phone Repairs
