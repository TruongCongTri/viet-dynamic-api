import { Router } from 'express';
// import { ENDPOINTS } from "@/constants/endpoints";
// import { CommerceController } from '../../commerces/commerce.controller';

const commerceRoute = Router();
// const commerceController = new CommerceController();

// // Wishlist
// commerceRoute.get(ENDPOINTS.COMMERCE.WISHLIST, commerceController.getWishlist);
// commerceRoute.post(ENDPOINTS.COMMERCE.WISHLIST + '/toggle', commerceController.toggleWishlist);
// // Cart
// commerceRoute.get(ENDPOINTS.COMMERCE.CART, commerceController.getCart);
// commerceRoute.post(ENDPOINTS.COMMERCE.CART_ITEMS, commerceController.addToCart);
// commerceRoute.post(ENDPOINTS.COMMERCE.CART + '/merge-guest-cart', commerceController.mergeCart);
// // Recently Viewed
// commerceRoute.get('/courses/recently-viewed', commerceController.getRecent);
// commerceRoute.post('/courses/:slug/view', commerceController.trackView);
// // Orders
// commerceRoute.post(ENDPOINTS.COMMERCE.ORDERS + '/checkout', commerceController.checkout);
// commerceRoute.post(ENDPOINTS.COMMERCE.ORDERS + '/:id/pay', commerceController.paymentInit);

export default commerceRoute;
