import 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    razorpay: {
      orders: {
        create(opts: {
          amount: number;
          currency: string;
          receipt: string;
          notes: Record<string, string>;
        }): Promise<{ id: string }>;
      };
      plans: {
        create(opts: {
          period: string;
          interval: number;
          item: { name: string; amount: number; currency: string; description: string };
        }): Promise<{ id: string }>;
      };
      subscriptions: {
        create(opts: {
          plan_id: string;
          customer_notify: number;
          total_count: number;
          notes: Record<string, string>;
        }): Promise<{ id: string }>;
        cancel(id: string): Promise<void>;
      };
    };
  }
}
