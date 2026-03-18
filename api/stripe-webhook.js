import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(readable) {
  const chunks = [];

  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = req.headers['stripe-signature'];

  let event;

  try {
    const rawBody = await getRawBody(req);

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    try {
      const session = event.data.object;

      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;

      if (!userId || !plan) {
        console.error('Missing metadata:', session.metadata);
        return res.status(400).send('Missing metadata');
      }

      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { error } = await supabase
        .from('profiles')
        .update({
          is_premium: true,
          plan: plan
        })
        .eq('id', userId);

      if (error) {
        console.error('Supabase update error:', error.message);
        return res.status(500).send(`Supabase Error: ${error.message}`);
      }
    } catch (err) {
      console.error('Webhook processing error:', err.message);
      return res.status(500).send(`Processing Error: ${err.message}`);
    }
  }

  return res.status(200).json({ received: true });
}
