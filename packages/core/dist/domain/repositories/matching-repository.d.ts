export interface Interaction {
    userId: string;
    targetId: string;
    targetType: 'user' | 'event';
    type: 'swipe' | 'view' | 'click';
    direction?: 'left' | 'right' | 'up';
    createdAt: string;
}
export interface IMatchingRepository {
    saveInteraction(interaction: Interaction): Promise<void>;
    getInteractedIds(userId: string, targetType: 'user' | 'event'): Promise<string[]>;
    getInteractionHistory(userId: string, limit: number): Promise<Interaction[]>;
}
