import Stripe from 'stripe';

export default async function handler(req, res) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const { plan, userId } = req.body;

  let priceId;

  if (plan === "complete") {
    priceId = process.env.STRIPE_PRICE_ID_COMPLETE;
  } else if (plan === "complete_plus_library") {
    priceId = process.env.STRIPE_PRICE_ID_COMPLETE_PLUS_LIBRARY;
  } else {
    return res.status(400).json({ error: "Invalid plan" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.SITE_URL}/success.html`,
      cancel_url: `${process.env.SITE_URL}/cancel.html`,
      metadata: {
        user_id: userId,
        plan: plan,
      },
    });

    res.status(200).json({ url: session.url });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
