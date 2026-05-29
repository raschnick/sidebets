type UserAvatarProps = {
  username: string;
  avatarUrl?: string | null;
  className: string;
  ariaHidden?: boolean;
};

export default function UserAvatar({ username, avatarUrl, className, ariaHidden = false }: UserAvatarProps) {
  const initial = username.trim().slice(0, 1).toUpperCase() || '?';

  return (
    <span className={`${className}${avatarUrl ? ' has-image' : ''}`} aria-hidden={ariaHidden}>
      {avatarUrl ? <img className="user-avatar-image" src={avatarUrl} alt="" /> : initial}
    </span>
  );
}
