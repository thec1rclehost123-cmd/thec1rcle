export interface Profile {
  uid: string;
  email?: string;
  displayName?: string;
  age?: number;
  photoURL?: string;
  gender?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface IProfileRepository {
  getById(id: string, type: 'user' | 'venue' | 'host'): Promise<Profile | null>;
  update(id: string, type: 'user' | 'venue' | 'host', updates: Partial<Profile>): Promise<void>;
  create(profile: Profile): Promise<void>;
  getPosts(id: string, type: string, limit: number): Promise<any[]>;
  getHighlights(id: string, type: string): Promise<any[]>;
}
