import { useCallback, useState } from "react";

interface UseFollowUserOptions {
  initialFollowers?: number;
  initialIsFollowing?: boolean;
}

export const useFollowUser = ({ initialFollowers = 0, initialIsFollowing = false }: UseFollowUserOptions = {}) => {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followers, setFollowers] = useState(initialFollowers);

  const toggleFollow = useCallback(() => {
    setIsFollowing((prev) => {
      const next = !prev;
      setFollowers((count) => count + (next ? 1 : -1));
      return next;
    });
  }, []);

  return { isFollowing, followers, toggleFollow };
};

export default useFollowUser;
