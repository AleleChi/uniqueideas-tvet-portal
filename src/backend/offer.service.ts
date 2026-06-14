/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AdmissionService } from "./admission.service";

/**
 * OfferService - Unified operational single-source-of-truth for generating,
 * compiling, and dispatching provisional offer letters to qualified candidates.
 */
export class OfferService {
  /**
   * Dispatches the admission offer letter and acceptance form PDFs to a beneficiary
   * @param beneficiaryId - Unique identifier of the beneficiary
   * @param customDomain - External URL for secure token-based user response portal
   */
  static async sendOffer(beneficiaryId: string, customDomain: string): Promise<any> {
    console.log(`[OfferService] Intercepting offer dispatch task for candidate: ${beneficiaryId}`);
    return AdmissionService.sendAdmissionOffer(beneficiaryId, customDomain);
  }
}
