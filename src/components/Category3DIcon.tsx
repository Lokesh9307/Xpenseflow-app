import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
  G,
  Ellipse,
  Polygon,
} from 'react-native-svg';

interface Category3DIconProps {
  category: string;
  icon?: string;
  size?: number;
}

/**
 * Category3DIcon: Ultra-premium 3D claymorphic & isometric vector icons
 * Handcrafted with multi-point gradient lighting, volumetric depth, specular sheens, and drop shadows.
 */
export const Category3DIcon: React.FC<Category3DIconProps> = ({ category, icon, size = 46 }) => {
  const normCat = ((icon || category) || '').toLowerCase().trim();

  // 🍔 Food & Dining: 3D Glossy Burger / Gourmet Plate
  const renderFood = () => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgFood" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FFF1EB" />
          <Stop offset="100%" stopColor="#FFDDD0" />
        </LinearGradient>
        <LinearGradient id="bunTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFA64D" />
          <Stop offset="40%" stopColor="#F97316" />
          <Stop offset="100%" stopColor="#C2410C" />
        </LinearGradient>
        <LinearGradient id="bunGloss" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFE8D6" stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#FFE8D6" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="patty" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#78350F" />
          <Stop offset="100%" stopColor="#451A03" />
        </LinearGradient>
        <LinearGradient id="cheese" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FDE047" />
          <Stop offset="100%" stopColor="#EAB308" />
        </LinearGradient>
        <LinearGradient id="lettuce" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#4ADE80" />
          <Stop offset="100%" stopColor="#16A34A" />
        </LinearGradient>
        <LinearGradient id="bunBottom" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FB923C" />
          <Stop offset="100%" stopColor="#C2410C" />
        </LinearGradient>
        <RadialGradient id="shadowFood" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#7C2D12" stopOpacity="0.35" />
          <Stop offset="100%" stopColor="#7C2D12" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* 3D Base Platform */}
      <Rect x="8" y="8" width="84" height="84" rx="22" fill="url(#bgFood)" />

      {/* Ambient Drop Shadow */}
      <Ellipse cx="50" cy="80" rx="28" ry="7" fill="url(#shadowFood)" />

      {/* Bottom Bun */}
      <Path
        d="M26 64 C26 62, 34 60, 50 60 C66 60, 74 62, 74 64 C74 71, 66 75, 50 75 C34 75, 26 71, 26 64 Z"
        fill="url(#bunBottom)"
      />

      {/* Juicy Patty */}
      <Path
        d="M23 54 C23 52, 32 50, 50 50 C68 50, 77 52, 77 54 C77 60, 68 62, 50 62 C32 62, 23 60, 23 54 Z"
        fill="url(#patty)"
      />

      {/* Melted Cheese Slice with 3D Corner Droop */}
      <Polygon points="26,53 74,53 66,61 50,56 36,63" fill="url(#cheese)" />

      {/* Wavy Emerald Lettuce */}
      <Path
        d="M22 49 Q28 44 34 49 Q40 44 48 49 Q56 44 64 49 Q72 44 78 49 C78 52 74 54 70 53 Q62 50 54 53 Q46 50 38 53 Q30 50 22 53 Z"
        fill="url(#lettuce)"
      />

      {/* 3D Glossy Top Bun Dome */}
      <Path
        d="M24 45 C24 25, 35 18, 50 18 C65 18, 76 25, 76 45 C76 48, 24 48, 24 45 Z"
        fill="url(#bunTop)"
      />

      {/* Top Specular Sheen (Gives real 3D clay gloss) */}
      <Path
        d="M32 23 C40 20, 56 20, 64 23 C58 27, 38 27, 32 23 Z"
        fill="url(#bunGloss)"
      />

      {/* 3D Sesame Seeds */}
      <Ellipse cx="42" cy="28" rx="2" ry="1.2" fill="#FEF3C7" transform="rotate(-15 42 28)" />
      <Ellipse cx="54" cy="27" rx="2.2" ry="1.2" fill="#FEF3C7" transform="rotate(10 54 27)" />
      <Ellipse cx="48" cy="35" rx="2" ry="1.1" fill="#FEF3C7" transform="rotate(-5 48 35)" />
      <Ellipse cx="62" cy="34" rx="1.8" ry="1.1" fill="#FEF3C7" transform="rotate(20 62 34)" />
      <Ellipse cx="36" cy="35" rx="1.8" ry="1" fill="#FEF3C7" transform="rotate(-20 36 35)" />
    </Svg>
  );

  // 🛍️ Shopping: 3D Isometric Glossy Shopping Bag with Floating Star
  const renderShopping = () => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgShop" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FDF2F8" />
          <Stop offset="100%" stopColor="#FCE7F3" />
        </LinearGradient>
        <LinearGradient id="bagFront" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#EC4899" />
          <Stop offset="50%" stopColor="#DB2777" />
          <Stop offset="100%" stopColor="#BE185D" />
        </LinearGradient>
        <LinearGradient id="bagSide" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#9D174D" />
          <Stop offset="100%" stopColor="#831843" />
        </LinearGradient>
        <LinearGradient id="bagFold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#F472B6" />
          <Stop offset="100%" stopColor="#DB2777" />
        </LinearGradient>
        <LinearGradient id="handleGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FDE047" />
          <Stop offset="100%" stopColor="#CA8A04" />
        </LinearGradient>
        <RadialGradient id="shadowShop" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#831843" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#831843" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="8" y="8" width="84" height="84" rx="22" fill="url(#bgShop)" />
      <Ellipse cx="50" cy="83" rx="26" ry="6" fill="url(#shadowShop)" />

      {/* Gold Handles */}
      <Path
        d="M40 38 C40 22, 60 22, 60 38"
        stroke="url(#handleGrad)"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* 3D Bag Side Accordion (Depth facet) */}
      <Polygon points="26,42 33,36 33,72 26,78" fill="url(#bagSide)" />

      {/* 3D Bag Front Face */}
      <Polygon points="33,36 76,36 70,74 33,72" fill="url(#bagFront)" />

      {/* Front Gloss Reflection Stripe */}
      <Path
        d="M37 38 L44 38 L41 71 L36 71 Z"
        fill="#FFFFFF"
        fillOpacity="0.25"
      />

      {/* 3D Gold Ribbon / Seal */}
      <Circle cx="54" cy="54" r="8" fill="url(#handleGrad)" />
      <Circle cx="54" cy="54" r="4.5" fill="#FEF08A" />

      {/* Sparkle Star */}
      <Path
        d="M74 24 Q74 30 78 30 Q74 30 74 36 Q74 30 70 30 Q74 30 74 24 Z"
        fill="#FACC15"
      />
    </Svg>
  );

  // 🚗 Travel & Commute: 3D Aerodynamic Sport Car / Transit
  const renderTravel = () => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgTravel" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#EFF6FF" />
          <Stop offset="100%" stopColor="#DBEAFE" />
        </LinearGradient>
        <LinearGradient id="carBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#38BDF8" />
          <Stop offset="40%" stopColor="#0284C7" />
          <Stop offset="100%" stopColor="#0369A1" />
        </LinearGradient>
        <LinearGradient id="carGlass" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#E0F2FE" />
          <Stop offset="100%" stopColor="#7DD3FC" />
        </LinearGradient>
        <LinearGradient id="wheelRim" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#64748B" />
          <Stop offset="100%" stopColor="#1E293B" />
        </LinearGradient>
        <RadialGradient id="shadowTravel" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#0C4A6E" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#0C4A6E" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="8" y="8" width="84" height="84" rx="22" fill="url(#bgTravel)" />
      <Ellipse cx="50" cy="80" rx="30" ry="7" fill="url(#shadowTravel)" />

      {/* Car Roof & Cabin Dome */}
      <Path
        d="M30 46 C34 32, 45 28, 56 28 C68 28, 73 34, 76 46 Z"
        fill="url(#carGlass)"
      />
      {/* Cabin Roof Top */}
      <Path
        d="M36 34 C42 30, 52 30, 64 34 L62 38 C52 34, 44 34, 38 38 Z"
        fill="#0284C7"
      />

      {/* Main 3D Car Body Sculpted Hull */}
      <Path
        d="M18 56 C18 50, 24 45, 33 45 L74 45 C82 45, 86 52, 84 62 C83 67, 78 68, 72 68 L26 68 C20 68, 18 64, 18 56 Z"
        fill="url(#carBody)"
      />

      {/* Front Light Beam */}
      <Polygon points="84,54 87,55 86,59 83,59" fill="#FEF08A" />

      {/* 3D Wheels with Rubber & Chrome Rim */}
      <G transform="translate(32, 67)">
        <Circle cx="0" cy="0" r="10" fill="#0F172A" />
        <Circle cx="0" cy="0" r="6" fill="url(#wheelRim)" />
        <Circle cx="0" cy="0" r="2.5" fill="#F8FAFC" />
      </G>
      <G transform="translate(68, 67)">
        <Circle cx="0" cy="0" r="10" fill="#0F172A" />
        <Circle cx="0" cy="0" r="6" fill="url(#wheelRim)" />
        <Circle cx="0" cy="0" r="2.5" fill="#F8FAFC" />
      </G>

      {/* Specular Highlight Streak */}
      <Path
        d="M25 49 C38 48, 65 48, 75 49"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeOpacity="0.75"
      />
    </Svg>
  );

  // ⚡ Bills & Utilities: 3D Neon Lightning Prism & Energy Cell
  const renderBills = () => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgBills" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FEFCE8" />
          <Stop offset="100%" stopColor="#FEF08A" />
        </LinearGradient>
        <LinearGradient id="boltFront" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FDE047" />
          <Stop offset="50%" stopColor="#EAB308" />
          <Stop offset="100%" stopColor="#CA8A04" />
        </LinearGradient>
        <LinearGradient id="boltEdge" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#B45309" />
          <Stop offset="100%" stopColor="#78350F" />
        </LinearGradient>
        <RadialGradient id="glowBills" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FACC15" stopOpacity="0.7" />
          <Stop offset="100%" stopColor="#FACC15" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="8" y="8" width="84" height="84" rx="22" fill="url(#bgBills)" />
      <Circle cx="50" cy="50" r="32" fill="url(#glowBills)" />

      {/* 3D Extruded Lightning Shadow/Facet */}
      <Polygon
        points="57,18 36,49 53,49 43,84 69,45 52,45"
        fill="url(#boltEdge)"
        transform="translate(4, 4)"
      />

      {/* 3D Main Lightning Bolt Face */}
      <Polygon
        points="55,16 34,47 51,47 41,82 67,43 50,43"
        fill="url(#boltFront)"
      />

      {/* Specular White Energy Edge */}
      <Path
        d="M55 16 L34 47 L48 47"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Sparkles */}
      <Circle cx="30" cy="28" r="2.5" fill="#EAB308" />
      <Circle cx="72" cy="62" r="2.5" fill="#EAB308" />
    </Svg>
  );

  // 🍿 Entertainment: 3D Popcorn / Cinema Golden Ticket
  const renderEntertainment = () => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgEnt" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FFF1F2" />
          <Stop offset="100%" stopColor="#FFE4E6" />
        </LinearGradient>
        <LinearGradient id="tubRed" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#F43F5E" />
          <Stop offset="100%" stopColor="#BE123C" />
        </LinearGradient>
        <LinearGradient id="tubWhite" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#E2E8F0" />
        </LinearGradient>
        <LinearGradient id="popcornGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FEF08A" />
          <Stop offset="50%" stopColor="#FACC15" />
          <Stop offset="100%" stopColor="#CA8A04" />
        </LinearGradient>
        <RadialGradient id="shadowEnt" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#9F1239" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#9F1239" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="8" y="8" width="84" height="84" rx="22" fill="url(#bgEnt)" />
      <Ellipse cx="50" cy="83" rx="24" ry="6" fill="url(#shadowEnt)" />

      {/* Striped 3D Popcorn Tub */}
      <Polygon points="30,46 70,46 64,78 36,78" fill="url(#tubRed)" />
      <Polygon points="38,46 44,46 42,78 38,78" fill="url(#tubWhite)" />
      <Polygon points="50,46 56,46 54,78 50,78" fill="url(#tubWhite)" />
      <Polygon points="62,46 66,46 63,78 61,78" fill="url(#tubWhite)" />

      {/* Tub Top Rim Shadow */}
      <Ellipse cx="50" cy="46" rx="20" ry="4" fill="#9F1239" />

      {/* 3D Fluffy Popcorn Kernels Clusters */}
      <Circle cx="40" cy="38" r="8" fill="url(#popcornGold)" />
      <Circle cx="52" cy="34" r="9" fill="url(#popcornGold)" />
      <Circle cx="62" cy="38" r="7.5" fill="url(#popcornGold)" />
      <Circle cx="46" cy="42" r="7" fill="#FEF08A" />
      <Circle cx="56" cy="41" r="7.5" fill="#FEF08A" />
      <Circle cx="35" cy="44" r="6" fill="#FDE047" />
      <Circle cx="65" cy="44" r="6" fill="#FDE047" />

      {/* 3D Cinema Stars */}
      <Polygon points="50,56 52,61 57,61 53,64 55,69 50,66 45,69 47,64 43,61 48,61" fill="#FACC15" />
    </Svg>
  );

  // 💚 Health & Fitness: 3D Glossy Heart / Medical Capsule
  const renderHealth = () => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgHealth" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#ECFDF5" />
          <Stop offset="100%" stopColor="#D1FAE5" />
        </LinearGradient>
        <LinearGradient id="heartGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#10B981" />
          <Stop offset="50%" stopColor="#059669" />
          <Stop offset="100%" stopColor="#047857" />
        </LinearGradient>
        <LinearGradient id="heartGloss" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#A7F3D0" stopOpacity="0" />
        </LinearGradient>
        <RadialGradient id="shadowHealth" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#065F46" stopOpacity="0.35" />
          <Stop offset="100%" stopColor="#065F46" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="8" y="8" width="84" height="84" rx="22" fill="url(#bgHealth)" />
      <Ellipse cx="50" cy="80" rx="24" ry="6" fill="url(#shadowHealth)" />

      {/* 3D Heart Body */}
      <Path
        d="M50 74 C26 56, 20 40, 26 29 C32 18, 44 20, 50 29 C56 20, 68 18, 74 29 C80 40, 74 56, 50 74 Z"
        fill="url(#heartGrad)"
      />

      {/* 3D Bevel/Specular Highlight on Left Lobe */}
      <Path
        d="M32 29 C36 22, 44 23, 47 28 C45 32, 38 34, 32 29 Z"
        fill="url(#heartGloss)"
      />

      {/* White Medical Pulse Track */}
      <Path
        d="M32 46 L42 46 L46 36 L52 54 L57 44 L61 48 L68 46"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );

  // 🛒 Groceries: 3D Fresh Apple & Produce Box
  const renderGroceries = () => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgGroc" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#F0FDF4" />
          <Stop offset="100%" stopColor="#DCFCE7" />
        </LinearGradient>
        <LinearGradient id="appleGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#EF4444" />
          <Stop offset="60%" stopColor="#DC2626" />
          <Stop offset="100%" stopColor="#991B1B" />
        </LinearGradient>
        <LinearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#4ADE80" />
          <Stop offset="100%" stopColor="#15803D" />
        </LinearGradient>
        <LinearGradient id="crateGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#D97706" />
          <Stop offset="100%" stopColor="#92400E" />
        </LinearGradient>
        <RadialGradient id="shadowGroc" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#14532D" stopOpacity="0.35" />
          <Stop offset="100%" stopColor="#14532D" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="8" y="8" width="84" height="84" rx="22" fill="url(#bgGroc)" />
      <Ellipse cx="50" cy="82" rx="28" ry="6" fill="url(#shadowGroc)" />

      {/* 3D Grocery Basket / Box */}
      <Polygon points="24,52 76,52 70,78 30,78" fill="url(#crateGrad)" />
      <Path d="M26 60 L74 60" stroke="#78350F" strokeWidth="2.5" />
      <Path d="M28 69 L72 69" stroke="#78350F" strokeWidth="2.5" />

      {/* 3D Big Glossy Red Apple sticking out */}
      <Path
        d="M50 34 C44 26, 32 28, 32 38 C32 50, 48 56, 50 58 C52 56, 68 50, 68 38 C68 28, 56 26, 50 34 Z"
        fill="url(#appleGrad)"
      />

      {/* Apple Specular Sheen */}
      <Ellipse cx="40" cy="36" rx="4" ry="2.5" fill="#FCA5A5" transform="rotate(-20 40 36)" />

      {/* Apple Stem & Leaf */}
      <Path d="M50 34 C50 26, 54 22, 57 20" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <Path d="M54 22 C62 20, 64 26, 58 27 C54 27, 52 24, 54 22 Z" fill="url(#leafGrad)" />
    </Svg>
  );

  // 📚 Education: 3D Graduation Mortarboard & Book
  const renderEducation = () => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgEdu" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#EEF2FF" />
          <Stop offset="100%" stopColor="#E0E7FF" />
        </LinearGradient>
        <LinearGradient id="capTop" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#4F46E5" />
          <Stop offset="50%" stopColor="#4338CA" />
          <Stop offset="100%" stopColor="#312E81" />
        </LinearGradient>
        <LinearGradient id="bookCover" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#38BDF8" />
          <Stop offset="100%" stopColor="#0284C7" />
        </LinearGradient>
        <RadialGradient id="shadowEdu" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#312E81" stopOpacity="0.35" />
          <Stop offset="100%" stopColor="#312E81" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="8" y="8" width="84" height="84" rx="22" fill="url(#bgEdu)" />
      <Ellipse cx="50" cy="82" rx="26" ry="6" fill="url(#shadowEdu)" />

      {/* 3D Book Base */}
      <Polygon points="26,66 50,73 74,66 74,74 50,80 26,74" fill="url(#bookCover)" />
      <Polygon points="28,64 50,70 72,64 72,68 50,74 28,68" fill="#F8FAFC" />

      {/* Graduation Cap Base Skullcap */}
      <Path d="M38 46 C38 54, 62 54, 62 46 Z" fill="#312E81" />

      {/* 3D Diamond Mortarboard Plaque */}
      <Polygon points="50,24 82,37 50,50 18,37" fill="url(#capTop)" />

      {/* Top Facet Sheen */}
      <Polygon points="50,25 78,37 50,47 24,37" fill="#6366F1" fillOpacity="0.4" />

      {/* Golden Button & Tassel */}
      <Circle cx="50" cy="37" r="3.5" fill="#FACC15" />
      <Path d="M50 37 Q66 40 68 52" stroke="#FACC15" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <Circle cx="68" cy="53" r="2.5" fill="#EAB308" />
    </Svg>
  );

  // 💎 Investment: 3D Stack of Gold Coins & Growth Arrow
  const renderInvestment = () => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgInv" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#ECFDF5" />
          <Stop offset="100%" stopColor="#D1FAE5" />
        </LinearGradient>
        <LinearGradient id="goldCoin" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FEF08A" />
          <Stop offset="40%" stopColor="#EAB308" />
          <Stop offset="100%" stopColor="#A16207" />
        </LinearGradient>
        <LinearGradient id="greenArrow" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#34D399" />
          <Stop offset="100%" stopColor="#059669" />
        </LinearGradient>
        <RadialGradient id="shadowInv" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#713F12" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#713F12" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="8" y="8" width="84" height="84" rx="22" fill="url(#bgInv)" />
      <Ellipse cx="50" cy="82" rx="28" ry="7" fill="url(#shadowInv)" />

      {/* 3D Bottom Coin */}
      <Path d="M28 66 C28 61, 72 61, 72 66 L72 73 C72 78, 28 78, 28 73 Z" fill="#A16207" />
      <Ellipse cx="50" cy="66" rx="22" ry="7" fill="url(#goldCoin)" />

      {/* 3D Middle Coin */}
      <Path d="M28 53 C28 48, 72 48, 72 53 L72 60 C72 65, 28 65, 28 60 Z" fill="#A16207" />
      <Ellipse cx="50" cy="53" rx="22" ry="7" fill="url(#goldCoin)" />

      {/* 3D Top Coin */}
      <Path d="M28 40 C28 35, 72 35, 72 40 L72 47 C72 52, 28 52, 28 47 Z" fill="#A16207" />
      <Ellipse cx="50" cy="40" rx="22" ry="7" fill="url(#goldCoin)" />

      {/* Inner Rim Engraving */}
      <Ellipse cx="50" cy="40" rx="17" ry="5.2" fill="none" stroke="#CA8A04" strokeWidth="1.5" />

      {/* 3D Green Rocketing Arrow */}
      <Polygon points="64,18 78,18 78,32 72,28 60,40 54,34 66,22" fill="url(#greenArrow)" />
    </Svg>
  );

  // 🍱 Tiffin Expense: 3D Steel Tiered Dabba with Handle
  const renderTiffin = () => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgTiffin" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FFF7ED" />
          <Stop offset="100%" stopColor="#FFEDD5" />
        </LinearGradient>
        <LinearGradient id="steelTier" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#CBD5E1" />
          <Stop offset="30%" stopColor="#F8FAFC" />
          <Stop offset="70%" stopColor="#94A3B8" />
          <Stop offset="100%" stopColor="#64748B" />
        </LinearGradient>
        <LinearGradient id="brassClamp" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#F97316" />
          <Stop offset="100%" stopColor="#C2410C" />
        </LinearGradient>
        <RadialGradient id="shadowTiffin" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#475569" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#475569" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="8" y="8" width="84" height="84" rx="22" fill="url(#bgTiffin)" />
      <Ellipse cx="50" cy="83" rx="26" ry="6" fill="url(#shadowTiffin)" />

      {/* Top Handle Arc */}
      <Path
        d="M36 36 C36 18, 64 18, 64 36"
        stroke="url(#brassClamp)"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Tier 3 (Bottom) */}
      <Path d="M28 62 C28 58, 72 58, 72 62 L72 74 C72 78, 28 78, 28 74 Z" fill="#64748B" />
      <Path d="M28 62 C28 59, 72 59, 72 62 L72 73 C72 76, 28 76, 28 73 Z" fill="url(#steelTier)" />

      {/* Tier 2 (Middle) */}
      <Path d="M28 48 C28 44, 72 44, 72 48 L72 60 C72 64, 28 64, 28 60 Z" fill="#64748B" />
      <Path d="M28 48 C28 45, 72 45, 72 48 L72 59 C72 62, 28 62, 28 59 Z" fill="url(#steelTier)" />

      {/* Tier 1 (Top) */}
      <Path d="M28 34 C28 30, 72 30, 72 34 L72 46 C72 50, 28 50, 28 46 Z" fill="#64748B" />
      <Path d="M28 34 C28 31, 72 31, 72 34 L72 45 C72 48, 28 48, 28 45 Z" fill="url(#steelTier)" />
      <Ellipse cx="50" cy="34" rx="22" ry="6" fill="#E2E8F0" />

      {/* Vertical Locking Latches */}
      <Rect x="26" y="36" width="3" height="38" rx="1.5" fill="url(#brassClamp)" />
      <Rect x="71" y="36" width="3" height="38" rx="1.5" fill="url(#brassClamp)" />
    </Svg>
  );

  // 🤝 Split / Shared: 3D Interlocking Floating Tokens
  const renderSplit = () => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgSplit" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#F5F3FF" />
          <Stop offset="100%" stopColor="#EDE9FE" />
        </LinearGradient>
        <LinearGradient id="tokenLeft" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#A78BFA" />
          <Stop offset="100%" stopColor="#7C3AED" />
        </LinearGradient>
        <LinearGradient id="tokenRight" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#38BDF8" />
          <Stop offset="100%" stopColor="#0284C7" />
        </LinearGradient>
        <RadialGradient id="shadowSplit" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#5B21B6" stopOpacity="0.35" />
          <Stop offset="100%" stopColor="#5B21B6" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="8" y="8" width="84" height="84" rx="22" fill="url(#bgSplit)" />
      <Ellipse cx="50" cy="80" rx="26" ry="6" fill="url(#shadowSplit)" />

      {/* Left Token */}
      <Circle cx="40" cy="48" r="18" fill="url(#tokenLeft)" />
      <Circle cx="40" cy="48" r="12" fill="#8B5CF6" />

      {/* Right Token Overlapping */}
      <Circle cx="60" cy="52" r="18" fill="url(#tokenRight)" />
      <Circle cx="60" cy="52" r="12" fill="#0EA5E9" />

      {/* Split Dividing Ray */}
      <Path
        d="M44 32 L56 68"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </Svg>
  );

  // 📦 Others / General: 3D Isometric Shaded Cube
  const renderOthers = () => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bgOther" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#F1F5F9" />
          <Stop offset="100%" stopColor="#E2E8F0" />
        </LinearGradient>
        <LinearGradient id="cubeTop" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#94A3B8" />
          <Stop offset="100%" stopColor="#64748B" />
        </LinearGradient>
        <LinearGradient id="cubeLeft" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#475569" />
          <Stop offset="100%" stopColor="#334155" />
        </LinearGradient>
        <LinearGradient id="cubeRight" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#1E293B" />
          <Stop offset="100%" stopColor="#0F172A" />
        </LinearGradient>
        <RadialGradient id="shadowOther" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#0F172A" stopOpacity="0.35" />
          <Stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="8" y="8" width="84" height="84" rx="22" fill="url(#bgOther)" />
      <Ellipse cx="50" cy="80" rx="26" ry="6" fill="url(#shadowOther)" />

      {/* Isometric 3D Cube */}
      {/* Top Face */}
      <Polygon points="50,26 74,38 50,50 26,38" fill="url(#cubeTop)" />
      {/* Left Face */}
      <Polygon points="26,38 50,50 50,74 26,62" fill="url(#cubeLeft)" />
      {/* Right Face */}
      <Polygon points="50,50 74,38 74,62 50,74" fill="url(#cubeRight)" />

      {/* Top Light Accent */}
      <Path d="M50 27 L72 38" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.5" />
    </Svg>
  );

  // Match icon by category string
  if (normCat.includes('food') || normCat.includes('dining') || normCat.includes('restaurant') || normCat.includes('cafe')) {
    return <View style={styles.container}>{renderFood()}</View>;
  }
  if (normCat.includes('shop') || normCat.includes('cloth') || normCat.includes('store')) {
    return <View style={styles.container}>{renderShopping()}</View>;
  }
  if (normCat.includes('travel') || normCat.includes('commute') || normCat.includes('fuel') || normCat.includes('cab') || normCat.includes('car')) {
    return <View style={styles.container}>{renderTravel()}</View>;
  }
  if (normCat.includes('bill') || normCat.includes('util') || normCat.includes('electric') || normCat.includes('recharge')) {
    return <View style={styles.container}>{renderBills()}</View>;
  }
  if (normCat.includes('entertain') || normCat.includes('movie') || normCat.includes('game') || normCat.includes('ott')) {
    return <View style={styles.container}>{renderEntertainment()}</View>;
  }
  if (normCat.includes('health') || normCat.includes('fit') || normCat.includes('gym') || normCat.includes('medic')) {
    return <View style={styles.container}>{renderHealth()}</View>;
  }
  if (normCat.includes('groc') || normCat.includes('vegetable') || normCat.includes('fruit') || normCat.includes('supermarket')) {
    return <View style={styles.container}>{renderGroceries()}</View>;
  }
  if (normCat.includes('edu') || normCat.includes('course') || normCat.includes('book') || normCat.includes('school')) {
    return <View style={styles.container}>{renderEducation()}</View>;
  }
  if (normCat.includes('invest') || normCat.includes('stock') || normCat.includes('crypto') || normCat.includes('gold')) {
    return <View style={styles.container}>{renderInvestment()}</View>;
  }
  if (normCat.includes('tiffin') || normCat.includes('dabba') || normCat.includes('meal')) {
    return <View style={styles.container}>{renderTiffin()}</View>;
  }
  if (normCat.includes('split') || normCat.includes('share') || normCat.includes('group')) {
    return <View style={styles.container}>{renderSplit()}</View>;
  }

  // If icon is a specific Ionicons name or vector glyph
  const iconStr = (icon || '').trim();
  if (iconStr && (iconStr.includes('-') || iconStr.includes('outline'))) {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.customVectorTile,
            {
              width: size,
              height: size,
              borderRadius: Math.round(size * 0.28),
            },
          ]}
        >
          <Ionicons name={iconStr as any} size={Math.round(size * 0.5)} color="#FFFFFF" />
        </View>
      </View>
    );
  }

  return <View style={styles.container}>{renderOthers()}</View>;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  customVectorTile: {
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
});
