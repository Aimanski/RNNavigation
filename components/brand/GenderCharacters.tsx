// Illustration

import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path } from "react-native-svg";

type Props = {
  size?: number;
  /* Props */
  backdrop?: string;
};

export function MaleCharacter({ size = 120, backdrop = "#CFE4FB" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <ClipPath id="clipMale">
          <Circle cx="60" cy="60" r="58" />
        </ClipPath>
      </Defs>
      <Circle cx="60" cy="60" r="58" fill={backdrop} />
      <G clipPath="url(#clipMale)">
        {/* Body */}
        <Path d="M10 124 C10 96 34 84 60 84 C86 84 110 96 110 124 Z" fill="#0B6FDB" />
        <Path
          d="M10 124 C10 96 34 84 60 84 C86 84 110 96 110 124"
          fill="none"
          stroke="#0A4B99"
          strokeWidth="1.5"
          opacity={0.35}
        />
        {/* Neck */}
        <Path d="M51 68 H69 V84 Q60 92 51 84 Z" fill="#E3AF84" />
        <Path d="M46 84 Q60 100 74 84 Q60 90 46 84 Z" fill="#F2C9A0" />
        <Path
          d="M46 84 Q60 100 74 84"
          fill="none"
          stroke="#0A4B99"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Ears */}
        <Circle cx="37.6" cy="52" r="4.6" fill="#EBB88C" />
        <Circle cx="82.4" cy="52" r="4.6" fill="#EBB88C" />
        {/* Head */}
        <Ellipse cx="60" cy="49" rx="22.5" ry="25" fill="#F2C9A0" />
        {/* Hair */}
        <Path
          d="M36.2 49 C32 24 48 14 62 14.5 C79 15 89 28 83.8 49 C82 40 77.5 34 69 32.6 C60 31.4 55 28.5 53.5 25.5 C50 33 42 40 36.2 49 Z"
          fill="#33231A"
        />
        <Path
          d="M47 21.5 C53 17.5 62 16.5 70 18.5"
          fill="none"
          stroke="#5A4234"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.7}
        />
        {/* Brows */}
        <Path d="M45.5 43.8 Q51 41 56 43.4" fill="none" stroke="#33231A" strokeWidth="2.4" strokeLinecap="round" />
        <Path d="M64 43.4 Q69 41 74.5 43.8" fill="none" stroke="#33231A" strokeWidth="2.4" strokeLinecap="round" />
        {/* Eyes */}
        <Ellipse cx="50.5" cy="50" rx="2.7" ry="3.1" fill="#2B2B2B" />
        <Ellipse cx="69.5" cy="50" rx="2.7" ry="3.1" fill="#2B2B2B" />
        <Circle cx="51.4" cy="48.8" r="0.9" fill="#FFFFFF" />
        <Circle cx="70.4" cy="48.8" r="0.9" fill="#FFFFFF" />
        {/* Face */}
        <Path d="M60 52.5 Q57.6 57.5 60.4 58.2" fill="none" stroke="#D49A6E" strokeWidth="2" strokeLinecap="round" />
        <Path d="M51.5 62 Q60 69.5 68.5 62" fill="none" stroke="#B5524A" strokeWidth="2.6" strokeLinecap="round" />
      </G>
    </Svg>
  );
}

export function FemaleCharacter({ size = 120, backdrop = "#FAD1EA" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <ClipPath id="clipFemale">
          <Circle cx="60" cy="60" r="58" />
        </ClipPath>
      </Defs>
      <Circle cx="60" cy="60" r="58" fill={backdrop} />
      <G clipPath="url(#clipFemale)">
        {/* Hair */}
        <Path
          d="M29 58 C24 26 44 10 60 10 C76 10 96 26 91 58 C91 78 96 100 90 124 L30 124 C24 100 29 78 29 58 Z"
          fill="#4A2C20"
        />
        {/* Body */}
        <Path d="M10 124 C10 96 34 84 60 84 C86 84 110 96 110 124 Z" fill="#E85D9E" />
        <Path
          d="M10 124 C10 96 34 84 60 84 C86 84 110 96 110 124"
          fill="none"
          stroke="#B83F7B"
          strokeWidth="1.5"
          opacity={0.35}
        />
        {/* Hair */}
        <Path d="M33 78 C31 94 34 110 38 124 L46 124 C42 108 41 92 41 78 Z" fill="#4A2C20" />
        <Path d="M87 78 C89 94 86 110 82 124 L74 124 C78 108 79 92 79 78 Z" fill="#4A2C20" />
        {/* Neck */}
        <Path d="M51 68 H69 V84 Q60 92 51 84 Z" fill="#E3AF84" />
        <Path d="M44 84 Q60 102 76 84 Q60 90 44 84 Z" fill="#F2C9A0" />
        <Path
          d="M44 84 Q60 102 76 84"
          fill="none"
          stroke="#B83F7B"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Ears */}
        <Circle cx="38.6" cy="53" r="4.4" fill="#EBB88C" />
        <Circle cx="81.4" cy="53" r="4.4" fill="#EBB88C" />
        <Circle cx="38.6" cy="59.2" r="2.1" fill="#F7D774" />
        <Circle cx="81.4" cy="59.2" r="2.1" fill="#F7D774" />
        {/* Head */}
        <Ellipse cx="60" cy="50" rx="21.5" ry="24.5" fill="#F2C9A0" />
        {/* Fringe */}
        <Path
          d="M37 48 C35.5 28 50 18.5 62 19.5 C77 20.5 85.5 31 83 48 C77 39 70 31 58 30 C48 31 41 39 37 48 Z"
          fill="#4A2C20"
        />
        <Path
          d="M50 24 C57 21 66 21 73 24"
          fill="none"
          stroke="#6E4A3A"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.7}
        />
        {/* Brows */}
        <Path d="M45.5 44.6 Q51 42 56 44.2" fill="none" stroke="#4A2C20" strokeWidth="2" strokeLinecap="round" />
        <Path d="M64 44.2 Q69 42 74.5 44.6" fill="none" stroke="#4A2C20" strokeWidth="2" strokeLinecap="round" />
        {/* Eyes */}
        <Ellipse cx="50.5" cy="51" rx="2.8" ry="3.2" fill="#2B2B2B" />
        <Ellipse cx="69.5" cy="51" rx="2.8" ry="3.2" fill="#2B2B2B" />
        <Circle cx="51.4" cy="49.8" r="0.95" fill="#FFFFFF" />
        <Circle cx="70.4" cy="49.8" r="0.95" fill="#FFFFFF" />
        <Path d="M46.7 48.8 L44.7 47.2" stroke="#2B2B2B" strokeWidth="1.7" strokeLinecap="round" />
        <Path d="M73.3 48.8 L75.3 47.2" stroke="#2B2B2B" strokeWidth="1.7" strokeLinecap="round" />
        {/* Face */}
        <Circle cx="45" cy="59" r="4" fill="#F28DB6" opacity={0.45} />
        <Circle cx="75" cy="59" r="4" fill="#F28DB6" opacity={0.45} />
        <Path d="M60 53.5 Q58 57.8 60.3 58.4" fill="none" stroke="#D49A6E" strokeWidth="1.9" strokeLinecap="round" />
        <Path d="M52 63 Q60 70 68 63" fill="none" stroke="#C2475E" strokeWidth="2.6" strokeLinecap="round" />
      </G>
    </Svg>
  );
}
