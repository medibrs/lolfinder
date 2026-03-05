import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { cdnUrl } from '@/lib/cdn';

interface IconProps {
    className?: string;
    size?: number;
}

const IconWrapper = ({ src, alt, className, size }: IconProps & { src: string; alt: string }) => (
    <div className={cn("relative flex items-center justify-center flex-shrink-0", className)} style={{ width: size, height: size }}>
        <Image
            src={src}
            alt={alt}
            fill
            className="object-contain"
            unoptimized
        />
    </div>
);

export const AdvanceArrowIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/advance_arrow.png")} alt="Advance Arrow" size={24} {...props} />
);

export const CalendarIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/calendar.png")} alt="Calendar" size={20} {...props} />
);

export const ClockIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/clock.png")} alt="Clock" size={20} {...props} />
);

export const EliminatedArrowIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/eliminated_arrow.png")} alt="Eliminated Arrow" size={24} {...props} />
);

export const EndedIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/ended.png")} alt="Ended" size={24} {...props} />
);

export const FirstPlaceTrophyIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/first_place_trophy.png")} alt="1st Place Trophy" size={180} {...props} />
);

export const HaloIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/halo.png")} alt="Halo" size={40} {...props} />
);

export const InfoIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/info.png")} alt="Info" size={20} {...props} />
);

export const LiveIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/live.png")} alt="Live" size={24} {...props} />
);

export const LoseArrowIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/lose_arrow.png")} alt="Lose Arrow" size={24} {...props} />
);

export const RegisterButtonIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/regester_button.png")} alt="Register Button" size={120} {...props} />
);

export const RegisterButtonPressedIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/regester_button_pressed.png")} alt="Register Button Pressed" size={120} {...props} />
);

export const SaveIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/save.png")} alt="Save" size={20} {...props} />
);

export const ScrollIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/scroll.png")} alt="Scroll" size={20} {...props} />
);

export const SecondPlaceMedalIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/second_place_medal.png")} alt="2nd Place Medal" size={100} {...props} />
);

export const SheildHollowIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/sheild_hollow.png")} alt="Shield Hollow" size={20} {...props} />
);

export const ShieldIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/shield.png")} alt="Shield" size={20} {...props} />
);

export const StatsIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/stats.png")} alt="Stats" size={20} {...props} />
);

export const TBDIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/tbd.png")} alt="TBD" size={20} {...props} />
);

export const TeamsIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/teams.png")} alt="Teams" size={20} {...props} />
);

export const ThirdPlaceMedalIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/third_place_medal.png")} alt="3rd Place Medal" size={100} {...props} />
);

export const TrashIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/trash.png")} alt="Trash" size={20} {...props} />
);

export const TrophyIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/trophy.png")} alt="Trophy" size={24} {...props} />
);

export const UpcomingIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/upcoming.png")} alt="Upcoming" size={24} {...props} />
);

export const WinArrowIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/win_arrow.png")} alt="Win Arrow" size={24} {...props} />
);

export const MatchCardIcon = (props: IconProps) => (
    <IconWrapper src={cdnUrl("/tournament_assets/match_card.png")} alt="Match Card" size={20} {...props} />
);
