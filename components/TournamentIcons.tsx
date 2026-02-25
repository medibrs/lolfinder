import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface IconProps {
    className?: string;
    size?: number;
}

export const CalendarIcon = ({ className, size = 20 }: IconProps) => (
    <div className={cn("relative flex items-center justify-center flex-shrink-0", className)} style={{ width: size, height: size }}>
        <Image
            src="/tournament_assets/calendar.png"
            alt="Calendar"
            fill
            className="object-contain"
        />
    </div>
);

export const ClockIcon = ({ className, size = 20 }: IconProps) => (
    <div className={cn("relative flex items-center justify-center flex-shrink-0", className)} style={{ width: size, height: size }}>
        <Image
            src="/tournament_assets/clock.png"
            alt="Clock"
            fill
            className="object-contain"
        />
    </div>
);

/**
 * Standard Teams Icon defaulting to the lightweight _small version.
 */
export const TeamsIcon = ({ className, size = 20 }: IconProps) => (
    <div className={cn("relative flex items-center justify-center flex-shrink-0", className)} style={{ width: size, height: size }}>
        <Image
            src="/tournament_assets/teams_small.png"
            alt="Teams"
            fill
            className="object-contain"
        />
    </div>
);

/**
 * Standard Trophy Icon defaulting to the lightweight _small version.
 */
export const TrophyIcon = ({ className, size = 24 }: IconProps) => (
    <div className={cn("relative flex items-center justify-center flex-shrink-0", className)} style={{ width: size, height: size }}>
        <Image
            src="/tournament_assets/trophy_small.png"
            alt="Trophy"
            fill
            className="object-contain"
        />
    </div>
);

export const InfoIcon = ({ className, size = 20 }: IconProps) => (
    <div className={cn("relative flex items-center justify-center flex-shrink-0", className)} style={{ width: size, height: size }}>
        <Image
            src="/tournament_assets/info.png"
            alt="Info"
            fill
            className="object-contain"
        />
    </div>
);

export const LiveIcon = ({ className, size = 24 }: IconProps) => (
    <div className={cn("relative flex items-center justify-center flex-shrink-0", className)} style={{ width: size, height: size }}>
        <Image
            src="/tournament_assets/live_small.png"
            alt="Live"
            fill
            className="object-contain"
        />
    </div>
);

export const UpcomingIcon = ({ className, size = 24 }: IconProps) => (
    <div className={cn("relative flex items-center justify-center flex-shrink-0", className)} style={{ width: size, height: size }}>
        <Image
            src="/tournament_assets/upcoming_small.png"
            alt="Upcoming"
            fill
            className="object-contain"
        />
    </div>
);

export const EndedIcon = ({ className, size = 24 }: IconProps) => (
    <div className={cn("relative flex items-center justify-center flex-shrink-0", className)} style={{ width: size, height: size }}>
        <Image
            src="/tournament_assets/ended_smll.png"
            alt="Ended"
            fill
            className="object-contain"
        />
    </div>
);

/**
 * High-fidelity podium assets for the Leaderboard.
 */
export const FirstPlaceTrophyIcon = ({ className, size = 180 }: IconProps) => (
    <div className={cn("relative flex items-center justify-center flex-shrink-0", className)} style={{ width: size, height: size }}>
        <Image
            src="/tournament_assets/first_place_trophy.png"
            alt="1st Place Trophy"
            fill
            className="object-contain"
        />
    </div>
);

export const SecondPlaceMedalIcon = ({ className, size = 100 }: IconProps) => (
    <div className={cn("relative flex items-center justify-center flex-shrink-0", className)} style={{ width: size, height: size }}>
        <Image
            src="/tournament_assets/second_place_medal.png"
            alt="2nd Place Medal"
            fill
            className="object-contain"
        />
    </div>
);

export const ThirdPlaceMedalIcon = ({ className, size = 100 }: IconProps) => (
    <div className={cn("relative flex items-center justify-center flex-shrink-0", className)} style={{ width: size, height: size }}>
        <Image
            src="/tournament_assets/third_place_medal.png"
            alt="3rd Place Medal"
            fill
            className="object-contain"
        />
    </div>
);
