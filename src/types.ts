/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHER = "OTHER"
}

export enum ProgramStatus {
  DRAFT = "DRAFT",
  PENDING_PHOTO = "PENDING_PHOTO",
  UNDER_REVIEW = "UNDER_REVIEW",
  VERIFIED = "VERIFIED",
  ENROLLED = "ENROLLED",
  IN_TRAINING = "IN_TRAINING",
  GRADUATED = "GRADUATED",
  ALUMNI = "ALUMNI",
  FLAGGED = "FLAGGED"
}

export interface CustomField {
  id: string;
  name: string; // e.g. "LGA"
  label: string; // e.g. "LGA / Ward"
  type: "text" | "number" | "select";
  options?: string[]; // Used for select type
  required: boolean;
}

export interface Beneficiary {
  id: string; // e.g. "IDEAS-[CURRENT_YEAR]-001"
  photo: string; // Base64 or image URL
  firstName: string;
  lastName: string;
  otherName?: string;
  gender: Gender;
  bvn: string;
  nin: string;
  state: string;
  city: string;
  phoneNumber: string;
  email: string;
  residentialAddress: string;
  batch: string;
  
  // Custom dynamic field values
  customFields: Record<string, string>;

  // Extended Lifecycle & Admission Workflow
  admissionStatus?: "Draft" | "Pending" | "Admission Generated" | "Admission Sent" | "Offer Viewed" | "Acceptance Pending" | "Acceptance Uploaded" | "Under Review" | "Accepted" | "Enrolled" | "Training In Progress" | "Training Completed" | "Certified" | "Alumni" | "Acceptance Rejected" | "Admitted";
  admissionRef?: string;
  admissionLetterGeneratedAt?: string;
  admissionLetterSentAt?: string;
  admissionFormCompleted?: boolean;
  admissionFormStatus?: "Pending" | "Draft" | "Submitted" | "Verified";
  admissionFormData?: {
    emergencyName?: string;
    emergencyPhone?: string;
    guardianName?: string;
    highestQualification?: string;
    priorKnowledge?: string;
    medicalDeclaration?: boolean;
    submissionDate?: string;
  };
  acceptanceLetterUploaded?: boolean;
  acceptanceLetterUrl?: string; // base64 or mock url
  acceptanceLetterUploadedAt?: string;
  admissionLetterUrl?: string;
  enrollmentLetterUrl?: string;
  certificateUrl?: string;
  
  // Operational email delivery tracking & analytics
  emailTrackingStatus?: "Sent" | "Failed" | "Delivered" | "Opened";
  emailTrackingHistory?: Array<{
    status: "Sent" | "Failed" | "Delivered" | "Opened";
    timestamp: string;
    description: string;
  }>;
  emailStatus?: "Not Sent" | "Sending" | "Sent" | "Failed";
  smtpErrorDetails?: string;
  emailDeliveryHistory?: Array<{
    dateSent: string;
    recipientEmail: string;
    deliveryResult: "Sent" | "Failed";
    smtpResponse: string;
  }>;

  // Versioning lists
  admissionLetterVersions?: Array<{
    version: number;
    url: string;
    name: string;
    generatedAt: string;
  }>;
  acceptanceLetterVersions?: Array<{
    version: number;
    url: string;
    name: string;
    uploadedAt: string;
  }>;
  admissionFormVersions?: Array<{
    version: number;
    formData: any;
    submittedAt: string;
  }>;

  documentsList?: Array<{
    id: string;
    name: string;
    type: string; // "nin" | "bvn" | "passport" | "admission" | "acceptance" | "other"
    url: string; // base64 payload or public mockup path
    uploadedAt: string;
    version?: number;
  }>;
  attendanceLogs?: Array<{
    id: string;
    date: string;
    status: "Present" | "Absent" | "Excused";
    hoursLogged: number;
  }>;
  trainingProgress?: {
    totalRequiredHours?: number;
    hoursCompleted?: number;
    completionStatus?: "Not Started" | "In Progress" | "Completed";
    grade?: string;
  };

  // System Fields
  tsp: string;          // e.g., "Unique Technology Nig. Ltd"
  program: string;      // e.g., "IDEAS-TVET Program"
  skillSector: string;  // e.g., "Computer Hardware and Cell Phone Repairs"
  
  // Statuses
  status: ProgramStatus;
  createdAt: string;
  updatedAt: string;

  // New Beneficiary Official Form Fields (Phase 1 Database Sync)
  guardianName?: string;
  guardianAddress?: string;
  guardianPhone?: string;
  physicalChallenge?: string;
  bankAccountHolder?: string;
  bankName?: string;
  bankSortCode?: string;
  bankAccountNumber?: string;
  educationQualification?: string;
}

export interface OrganizationSettings {
  id: string;
  organizationName: string;
  tpmName: string;
  tpmTitle: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  letterheadUrl: string;
  signatureUrl: string;
  stampUrl: string;
  watermarkText?: string;
  watermarkEnabled?: boolean;
  updatedAt?: string;
}

export interface TrainingProgram {
  id: string;
  name: string;
  sector: string;
  code: string;
  totalHours: string;
}

export interface Certificate {
  id: string;
  beneficiaryId: string;
  certificateNo: string;
  issuedAt: string;
  verifyStampUrl: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  username: string;
  role: string;
  action: string;
  details: string;
  ipAddress?: string;
}

export interface AppUser {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN_OFFICER" | "REVIEW_OFFICER" | "TRAINEE";
  beneficiaryId?: string;
  failedLoginAttempts: number;
  lockoutUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  isAuthenticated: boolean;
  username: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN_OFFICER" | "REVIEW_OFFICER" | "TRAINEE";
  token?: string;
  beneficiaryId?: string;
}

export enum DocumentType {
  ADMISSION_LETTER = "ADMISSION_LETTER",
  ACCEPTANCE_LETTER = "ACCEPTANCE_LETTER",
  ADMISSION_FORM = "ADMISSION_FORM",
  PHOTO_ALBUM = "PHOTO_ALBUM",
  ENROLLMENT_CONFIRMATION = "ENROLLMENT_CONFIRMATION",
  COMPLETION_CERTIFICATE = "COMPLETION_CERTIFICATE"
}

export interface GeneratedDocument {
  id: string;
  beneficiaryId: string;
  documentType: DocumentType;
  version: number;
  pdfUrl: string;
  docxUrl?: string;
  generatedBy: string;
  createdAt: string;
  verificationCode?: string;
  verificationStatus?: string;
  verificationDate?: string;
  verifiedAt?: string;
  emailDeliveryStatus?: string;
}
