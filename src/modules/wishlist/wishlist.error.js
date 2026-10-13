export class WishlistError extends Error {
  constructor(message, statusCode = 422) {
    super(message);
    this.name = "WishlistError";
    this.statusCode = statusCode;
  }
}

export function wishlistNotFound() {
  return new WishlistError("The requested product could not be found.", 404);
}
