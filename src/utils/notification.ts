import { ToastType } from "../components/NotificationContext";

export const ENTERPRISE_MESSAGES = {
  SUCCESS: "Action completed successfully.",
  INVITATION: "Invitation prepared successfully.\n\nThe organization will receive instructions to continue onboarding.",
  DELETION: "Item moved to Restoration Center.",
  UPDATE: "Changes have been saved successfully.",
  ERROR: "We couldn't complete this action.\n\nPlease try again or contact the administrator.",
  WARNING: "This action may affect other records. Continue?",
  INFO: "Processing your request..."
};

export function triggerEnterpriseToast(
  showToast: (msg: string, type: ToastType) => void,
  key: keyof typeof ENTERPRISE_MESSAGES,
  customDetail?: string
) {
  const baseMessage = ENTERPRISE_MESSAGES[key];
  const typeMap: Record<keyof typeof ENTERPRISE_MESSAGES, ToastType> = {
    SUCCESS: "success",
    INVITATION: "success",
    DELETION: "warning",
    UPDATE: "success",
    ERROR: "error",
    WARNING: "warning",
    INFO: "info"
  };
  
  const finalMsg = customDetail 
    ? `${baseMessage}\n\n${customDetail}` 
    : baseMessage;
    
  showToast(finalMsg, typeMap[key]);
}
