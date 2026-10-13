import { getHomeFeed } from "./home.service.js";
import { homeFeedQuerySchema } from "./home.validation.js";

function validationError(response) {
  return response.status(400).json({
    success: false,
    data: null,
    message: "The request parameters are invalid. Use lang=en or lang=it.",
  });
}

export async function getHomeFeedController(request, response) {
  const parsed = homeFeedQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return validationError(response);
  }

  try {
    const data = await getHomeFeed(request.locale);

    // Home placements are authored from the admin panel and need to appear on
    // the shopper app's next refresh. In particular, allowing a stale
    // response here meant Flutter Web could continue to paint an old feed for
    // up to five minutes after a placement had been published or changed.
    // Revalidation keeps browser clients fresh without changing media/S3
    // caching behaviour.
    response.set("Cache-Control", "no-cache, max-age=0, must-revalidate");

    return response.status(200).json({
      success: true,
      data,
      message: "Home feed retrieved successfully.",
    });
  } catch (error) {
    request.log?.error(
      {
        component: "home",
        err: error,
      },
      "Home feed request failed",
    );

    return response.status(500).json({
      success: false,
      data: null,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
}
