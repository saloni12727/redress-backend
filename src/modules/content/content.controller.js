import { getPrivacyPolicy } from "./content.service.js";

export async function privacyPolicyController(_request, response, next) {
  try {
    return response.status(200).json({
      success: true,
      data: await getPrivacyPolicy(),
      message: "Privacy policy retrieved successfully.",
    });
  } catch (error) {
    return next(error);
  }
}
