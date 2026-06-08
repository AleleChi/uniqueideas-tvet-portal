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
  PENDING = "PENDING",
  PENDING_PHOTO = "PENDING_PHOTO",
  UNDER_REVIEW = "UNDER_REVIEW",
  ADMITTED = "ADMITTED",
  ACCEPTED = "ACCEPTED",
  VERIFIED = "VERIFIED",
  ENROLLED = "ENROLLED",
  IN_TRAINING = "IN_TRAINING",
  GRADUATED = "GRADUATED",
  CERTIFICATION_PENDING = "CERTIFICATION_PENDING",
  CERTIFIED = "CERTIFIED",
  CERTIFICATE_ISSUED = "CERTIFICATE_ISSUED",
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
  hasPhoto?: boolean;
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
  admissionFormRef?: string;
  admissionLetterGeneratedAt?: string;
  admissionLetterSentAt?: string;
  admissionFormCompleted?: boolean;
  admissionFormStatus?: "Pending" | "Draft" | "Submitted" | "Verified" | "NOT_GENERATED" | "GENERATED" | "IN_PROGRESS" | "VIEWED" | "CONFIRMED" | "LOCKED";
  admissionFormData?: {
    emergencyName?: string;
    emergencyPhone?: string;
    guardianName?: string;
    guardianAddress?: string;
    guardianPhone?: string;
    physicalChallenge?: string;
    bankAccountHolder?: string;
    bankName?: string;
    bankSortCode?: string;
    bankAccountNumber?: string;
    bvn?: string;
    highestQualification?: string;
    priorKnowledge?: string;
    medicalDeclaration?: boolean | string;
    submissionDate?: string;
  };
  acceptanceLetterUploaded?: boolean;
  acceptanceLetterUrl?: string; // base64 or mock url
  acceptanceLetterUploadedAt?: string;
  acceptanceLetterStatus?: string;
  acceptanceLetterRemarks?: string;
  acceptanceLetterCheckedBy?: string;
  acceptanceLetterCheckedAt?: string;
  admissionLetterUrl?: string;
  admissionFormGeneratedAt?: string;
  admissionFormConfirmedAt?: string;
  admissionFormViewedAt?: string;
  admissionFormPdfUrl?: string;
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
  dateOfBirth?: string;
  beneficiaryStatus?: string; // DEFAULT: 'ACTIVE'
  statusReason?: string;
  statusChangedAt?: string;
  statusChangedBy?: string;
  isArchived?: boolean; // DEFAULT: false
  eligibilityOverride?: boolean;
  eligibilityOverrideReason?: string;
  eligibilityOverrideBy?: string;
  eligibilityOverrideAt?: string;
  age?: number | null;
  eligibilityStatus?: "ELIGIBLE" | "OVER_AGE" | "UNKNOWN_DOB" | "OVERRIDDEN";

  // Certification & Graduation Management System Fields
  certificationStatus?: "NONE" | "CERTIFICATION_PENDING" | "CERTIFIED" | "CERTIFICATE_ISSUED";
  certificateNumber?: string;
  certificateIssuedAt?: string;
  certificateIssuedBy?: string;
  graduationBatch?: string;
  alumniStatus?: boolean;
  certificateReference?: string;
  certificateVerificationCode?: string;
  certificateDownloadCount?: number;
  certificateLastDownloadedAt?: string;

  // Alumni Directory Demographics
  alumniEmploymentStatus?: string;
  alumniEntrepreneurStatus?: string;
  alumniBusinessName?: string;
  alumniCurrentEmployer?: string;
}

export enum BeneficiaryStatus {
  APPLIED = "APPLIED",
  UNDER_REVIEW = "UNDER_REVIEW",
  ADMITTED = "ADMITTED",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  WITHDRAWN = "WITHDRAWN",
  FAILED_VERIFICATION = "FAILED_VERIFICATION",
  DISQUALIFIED = "DISQUALIFIED",
  REMOVED = "REMOVED",
  ARCHIVED = "ARCHIVED"
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
  fmeLogoUrl?: string;
  ideasLogoUrl?: string;
  worldBankLogoUrl?: string;
  nbteLogoUrl?: string;
  customLogoUrl?: string;
  watermarkText?: string;
  watermarkEnabled?: boolean;
  admissionLetterheadUrl?: string;
  acceptanceLetterheadUrl?: string;
  enrollmentLetterheadUrl?: string;
  certificateBackgroundUrl?: string;
  photoAlbumHeaderUrl?: string;
  trainingVenue?: string;
  trainingStartDate?: string;
  trainingEndDate?: string;
  attendanceThreshold?: number;
  completionThreshold?: number;
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

export interface WorkflowHistory {
  id?: number | string;
  beneficiaryId: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  changedAt: string;
  remarks?: string;
  reason?: string;
  ipAddress?: string;
}

export interface InstitutionLetterhead {
  id: string;
  name: string;
  description?: string;
  fileUrl: string;
  thumbnailUrl?: string;
  fileType: "PDF" | "PNG" | "JPG" | "JPEG";
  isDefault: boolean;
  isActive: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdmissionFormTemplate {
  id: string;
  name: string;
  description?: string;
  fileUrl: string;
  fileType: "PDF" | "PNG" | "JPG" | "JPEG";
  isDefault: boolean;
  isActive: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  templateType: string; // "ADMISSION_FORM" | "ADMISSION_LETTER" | "ACCEPTANCE_LETTER" | "OFFER_LETTER" | "GENERAL"
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDispatch {
  id: string;
  beneficiaryId: string;
  documentType: string; // "ADMISSION_FORM" | "ADMISSION_LETTER" | "ACCEPTANCE_LETTER" | "OFFER_LETTER"
  documentReference?: string;
  emailAddress: string;
  status: "NOT_SENT" | "QUEUED" | "PROCESSING" | "SENT" | "DELIVERED" | "OPENED" | "DOWNLOADED" | "FAILED" | "EXPIRED" | "REVOKED";
  sentAt?: string;
  openedAt?: string;
  downloadedAt?: string;
  failedAt?: string;
  failureReason?: string;
  deliveryProvider?: string;
  messageId?: string;
  secureToken?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

