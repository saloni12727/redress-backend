import { ContentPolicy } from "../../models/index.js";
import { AppError } from "../../utils/app-error.js";

function dto(policy) {
  return {
    id: policy.id,
    title: policy.title,
    updatedAt: new Date(policy.updatedAt).toISOString(),
    sections: Array.isArray(policy.sections) ? policy.sections : [],
  };
}

export async function findPublishedPrivacyPolicy() {
  return ContentPolicy.findOne({ where: { id: "privacy", isPublished: true } });
}

export async function getPrivacyPolicy() {
  const policy = await findPublishedPrivacyPolicy();
  if (!policy) {
    throw new AppError({
      message: "The privacy policy is temporarily unavailable.",
      statusCode: 503,
      errorCode: "SERVICE_UNAVAILABLE",
      messageKey: "errorServiceUnavailable",
      details: { retryable: true, reason: "privacy_policy_unavailable" },
    });
  }
  return dto(policy);
}

export async function getPrivacyPolicyVersion() {
  const policy = await findPublishedPrivacyPolicy();
  return policy?.updatedAt ? new Date(policy.updatedAt).toISOString() : null;
}
