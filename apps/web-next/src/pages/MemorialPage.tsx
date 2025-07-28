import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSiderStoreShallow } from '@refly/stores';
import earlyBirdsData from './early-birds.json';
import { Button, Avatar, Modal, message, Tooltip } from 'antd';
import {
  ShareAltOutlined,
  StarOutlined,
  HeartOutlined,
  ThunderboltOutlined,
  CrownOutlined,
  FireOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
  useTime,
} from 'framer-motion';
import html2canvas from 'html2canvas';
import { PulsatingButton, ShimmerButton, OrbitingCircles } from '../components/magicui';
import './MemorialPage.css';

// 当前登录用户的名称，实际项目中应该从登录状态获取
const CURRENT_USER_NAME = 'digua'; // 示例：当前登录用户名称

interface Member {
  id: string;
  name: string;
  nickname: string;
  avatar: string;
  isCurrentUser?: boolean;
}

// 生成默认头像的背景色数组 - 丰富的品牌色系组合
const avatarBgColors = [
  'linear-gradient(135deg, #0e9f77 0%, #00968F 100%)', // 主品牌绿
  'linear-gradient(135deg, #46C0B2 0%, #1FAB9F 100%)', // 清新绿松石
  'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', // 互补蓝色
  'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', // 紫色点缀
  'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', // 暖橙色
  'linear-gradient(135deg, #74D5C6 0%, #46C0B2 100%)', // 浅绿松石
  'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)', // 青色
  'linear-gradient(135deg, #10B981 0%, #059669 100%)', // 翠绿色
  'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', // 靛蓝色
  'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)', // 粉紫色
  'linear-gradient(135deg, #008481 0%, #00716A 100%)', // 深绿色
  'linear-gradient(135deg, #1FAB9F 0%, #008481 100%)', // 中绿色
  'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', // 珊瑚红
  'linear-gradient(135deg, #E8FFFA 0%, #AAEADE 100%)', // 浅薄荷
  'linear-gradient(135deg, #00968F 0%, #0e9f77 100%)', // 品牌绿变种
  'linear-gradient(135deg, #A855F7 0%, #9333EA 100%)', // 紫罗兰
  'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)', // 天蓝色
  'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)', // 草绿色
  'linear-gradient(135deg, #F97316 0%, #EA580C 100%)', // 橘色
];

// 获取文本的简拼（拼音首字母缩写）
function getSimplePinyin(text: string | null | undefined): string {
  if (!text) return 'U';

  // 简单处理：取每个字的第一个字符
  // 对于中文，这不是真正的拼音，但可以作为简单实现
  // 实际项目中可以使用专门的拼音库（如pinyin.js）
  return text
    .split('')
    .map((char) => char.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2); // 最多取两个字符
}

// 检查URL是否有效
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  // 检查是否是有效的URL格式
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/');
}

// 生成基于文本的优雅渐变头像 - 使用Refly品牌色系
function generateTextAvatar(name: string | null | undefined): string {
  // 处理空值情况
  const safeName = name || 'User';

  // 基于名字生成一个稳定的索引
  const colorIndex =
    safeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarBgColors.length;

  // 获取昵称的简拼
  const simplePinyin = getSimplePinyin(safeName);
  let fontSize = 36;

  // 根据简拼长度调整字体大小
  if (simplePinyin.length > 1) {
    fontSize = 32; // 两个字符时稍微小一点
  }

  // 获取渐变色的主色调用于SVG定义 - 丰富的色彩组合
  const gradientColors = [
    { start: '#0e9f77', end: '#00968F' }, // 主品牌绿
    { start: '#46C0B2', end: '#1FAB9F' }, // 清新绿松石
    { start: '#3B82F6', end: '#1D4ED8' }, // 互补蓝色
    { start: '#8B5CF6', end: '#7C3AED' }, // 紫色点缀
    { start: '#F59E0B', end: '#D97706' }, // 暖橙色
    { start: '#74D5C6', end: '#46C0B2' }, // 浅绿松石
    { start: '#06B6D4', end: '#0891B2' }, // 青色
    { start: '#10B981', end: '#059669' }, // 翠绿色
    { start: '#6366F1', end: '#4F46E5' }, // 靛蓝色
    { start: '#EC4899', end: '#DB2777' }, // 粉紫色
    { start: '#008481', end: '#00716A' }, // 深绿色
    { start: '#1FAB9F', end: '#008481' }, // 中绿色
    { start: '#EF4444', end: '#DC2626' }, // 珊瑚红
    { start: '#E8FFFA', end: '#AAEADE' }, // 浅薄荷
    { start: '#00968F', end: '#0e9f77' }, // 品牌绿变种
    { start: '#A855F7', end: '#9333EA' }, // 紫罗兰
    { start: '#0EA5E9', end: '#0284C7' }, // 天蓝色
    { start: '#22C55E', end: '#16A34A' }, // 草绿色
    { start: '#F97316', end: '#EA580C' }, // 橘色
  ];

  const gradient = gradientColors[colorIndex % gradientColors.length];

  // 创建优雅的Refly风格SVG头像
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="grad${colorIndex}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${gradient.start.replace('#', '%23')};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${gradient.end.replace('#', '%23')};stop-opacity:1" />
      </linearGradient>
      <filter id="softGlow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge> 
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(%23grad${colorIndex})" filter="url(%23softGlow)"/>
    <text x="50" y="55" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="${fontSize}" font-weight="600" fill="white" text-anchor="middle" dominant-baseline="central" style="filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.2))">${simplePinyin}</text>
  </svg>`;
}

const MemorialPage: React.FC = () => {
  const [visibleAvatars, setVisibleAvatars] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [hoveredAvatar, setHoveredAvatar] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shareImageRef = useRef<HTMLDivElement>(null);
  const avatarWallRef = useRef<HTMLDivElement>(null);

  // 获取 setCollapse 方法用于控制侧边栏
  const { setCollapse } = useSiderStoreShallow((state) => ({
    setCollapse: state.setCollapse,
  }));

  // 在组件加载时自动收起侧边栏
  useEffect(() => {
    setCollapse(true);
  }, []);

  // Generate mock early bird users
  const earlyBirdUsers = useMemo(() => generateEarlyBirdUsers(), []);

  // Find current user
  const currentUser = useMemo(
    () => earlyBirdUsers.find((user) => user.isCurrentUser) || earlyBirdUsers[0],
    [earlyBirdUsers],
  );

  // Advanced scroll-based animations
  const { scrollY } = useScroll();
  const headerY = useTransform(scrollY, [0, 400], [0, -100]);
  const headerScale = useTransform(scrollY, [0, 300], [1, 0.9]);
  const headerOpacity = useTransform(scrollY, [0, 200], [1, 0.7]);

  // Enhanced parallax effects
  const bgY = useTransform(scrollY, [0, 1000], [0, 300]);
  const particleY = useTransform(scrollY, [0, 1000], [0, -200]);

  // Premium mouse parallax with multiple layers
  const mouseX = useSpring(0, { stiffness: 100, damping: 30 });
  const mouseY = useSpring(0, { stiffness: 100, damping: 30 });
  const mouseXFast = useSpring(0, { stiffness: 200, damping: 25 });
  const mouseYFast = useSpring(0, { stiffness: 200, damping: 25 });
  const mouseXSlow = useSpring(0, { stiffness: 50, damping: 40 });
  const mouseYSlow = useSpring(0, { stiffness: 50, damping: 40 });

  // Time-based animations
  const time = useTime();
  const rotateX = useTransform(time, [0, 4000], [0, 360], { clamp: false });
  const rotateY = useTransform(time, [0, 6000], [0, 360], { clamp: false });

  // Premium animation variants with enhanced 3D effects
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 1.5,
        staggerChildren: 0.05,
        delayChildren: 0.3,
      },
    },
  };

  const heroVariants = {
    hidden: {
      opacity: 0,
      y: 80,
      scale: 0.7,
      rotateX: -20,
      rotateY: 10,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotateX: 0,
      rotateY: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 25,
        duration: 2,
      },
    },
  };

  const avatarVariants = {
    hidden: {
      opacity: 0,
      scale: 0,
      y: 150,
      rotateY: 180,
      rotateX: -90,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      rotateY: 0,
      rotateX: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 150,
        damping: 25,
        duration: 1.2,
      },
    },
    hover: {
      scale: 1.25,
      y: -15,
      rotateY: 15,
      rotateX: 10,
      z: 50,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 20,
      },
    },
  };

  // Enhanced avatar grid variants with wave effect
  const avatarGridVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.02,
        delayChildren: 0.5,
      },
    },
  };

  function generateEarlyBirdUsers(): Member[] {
    // 使用真实的早鸟数据
    const users = earlyBirdsData.map((user, index) => {
      // 处理空值情况
      if (!user || (!user.name && !user.nickname)) {
        return {
          id: `user-${index}`, // 使用索引作为ID
          name: `用户${index}`,
          nickname: `用户${index}`,
          avatar: generateTextAvatar(null),
          isCurrentUser: false,
        };
      }

      // 根据name字段匹配当前用户
      const isCurrentUser = user.name === CURRENT_USER_NAME;
      const displayName = user.nickname || user.name;

      // 直接使用name作为ID，如果name为空则使用索引
      // 对于当前用户，使用'current-user'作为ID
      const uniqueId = isCurrentUser ? 'current-user' : user.name || `user-${index}`;

      // 检查头像URL是否有效，确保总是返回字符串
      const avatar = isValidImageUrl(user.avatar) ? user.avatar! : generateTextAvatar(displayName);

      return {
        id: uniqueId,
        name: user.name || `用户${index}`,
        nickname: displayName || `用户${index}`,
        avatar,
        isCurrentUser,
      };
    });

    // 确保当前用户排在第一位
    return users.sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return 0;
    });
  }

  // Enhanced mouse move handler with multiple parallax layers
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (event.clientY - rect.top - rect.height / 2) / rect.height;

      mouseX.set(x * 30);
      mouseY.set(y * 30);
      mouseXFast.set(x * 60);
      mouseYFast.set(y * 60);
      mouseXSlow.set(x * 15);
      mouseYSlow.set(y * 15);
    },
    [mouseX, mouseY, mouseXFast, mouseYFast, mouseXSlow, mouseYSlow],
  );

  // Enhanced avatar loading with wave animation
  useEffect(() => {
    const loadAvatars = async () => {
      // 预处理头像，检查URL是否有效
      const processedUsers = earlyBirdUsers.map((user) => {
        // 如果头像URL不是以http或data:开头，可能是无效URL，直接使用文本头像
        if (user.avatar && !(user.avatar.startsWith('http') || user.avatar.startsWith('data:'))) {
          return {
            ...user,
            avatar: generateTextAvatar(user.nickname || user.name),
          };
        }
        return user;
      });
      setVisibleAvatars(processedUsers);
    };
    loadAvatars();
  }, [earlyBirdUsers]);

  const _getBadgeIcon = (badge: string) => {
    switch (badge) {
      case 'legendary':
        return <CrownOutlined className="text-amber-600" />;
      case 'founder':
        return <StarOutlined className="text-teal-600" />;
      case 'pioneer':
        return <ThunderboltOutlined className="text-blue-600" />;
      default:
        return <HeartOutlined className="text-pink-600" />;
    }
  };

  const generateShareImage = async () => {
    if (!shareImageRef.current) return;

    try {
      const canvas = await html2canvas(shareImageRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement('a');
      // 使用名字生成一个唯一的编号，替代之前的wallNumber
      const uniqueNumber =
        Array.from(currentUser.name).reduce((acc, char) => acc + char.charCodeAt(0), 0) % 1000;
      link.download = `refly-early-bird-${uniqueNumber}.png`;
      link.href = canvas.toDataURL();
      link.click();

      message.success('分享图片已生成并下载！');
    } catch (error) {
      console.error('生成分享图片失败:', error);
      message.error('生成分享图片失败，请重试');
    }
  };

  const shareToSocial = (platform: string) => {
    message.info(`分享到${platform}功能即将开放`);
  };

  return (
    <motion.div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      onMouseMove={handleMouseMove}
      style={{
        background:
          'radial-gradient(ellipse at top, #f0fdfa 0%, #ccfbf1 30%, #a7f3d0 60%, #f0fdfa 100%)',
      }}
    >
      {/* Enhanced Background Effects with Multiple Layers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Dynamic mesh gradient background with diverse colors */}
        <motion.div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, #0e9f77, #3B82F6, #46C0B2, #8B5CF6, #F59E0B, #74D5C6, #06B6D4, #10B981, #6366F1, #EC4899, #00968F, #1FAB9F, #0e9f77)',
            y: bgY,
          }}
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 120,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'linear',
          }}
        />

        {/* Enhanced gradient orbs with diverse colors */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-15"
          style={{
            background: 'radial-gradient(circle, #0e9f77 0%, #3B82F6 30%, transparent 70%)',
            top: '10%',
            right: '5%',
            x: mouseXSlow,
            y: mouseYSlow,
            rotateX,
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.08, 0.2, 0.08],
          }}
          transition={{
            scale: { duration: 20, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
            opacity: { duration: 15, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
          }}
        />

        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full blur-3xl opacity-12"
          style={{
            background: 'radial-gradient(circle, #8B5CF6 0%, #EC4899 30%, transparent 70%)',
            bottom: '5%',
            left: '10%',
            x: mouseX,
            y: mouseY,
            rotateY,
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.06, 0.15, 0.06],
          }}
          transition={{
            scale: { duration: 25, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
            opacity: { duration: 18, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
          }}
        />

        <motion.div
          className="absolute w-[350px] h-[350px] rounded-full blur-3xl opacity-15"
          style={{
            background: 'radial-gradient(circle, #F59E0B 0%, #06B6D4 30%, transparent 70%)',
            top: '50%',
            left: '50%',
            x: mouseXFast,
            y: mouseYFast,
          }}
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.08, 0.2, 0.08],
            rotate: [0, 180, 360],
          }}
          transition={{
            scale: { duration: 15, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
            opacity: { duration: 12, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
            rotate: { duration: 30, repeat: Number.POSITIVE_INFINITY, ease: 'linear' },
          }}
        />

        {/* Diverse floating particles with varied colors */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-1 h-1 rounded-full ${
              i % 6 === 0
                ? 'bg-teal-500/60'
                : i % 6 === 1
                  ? 'bg-blue-500/60'
                  : i % 6 === 2
                    ? 'bg-purple-500/60'
                    : i % 6 === 3
                      ? 'bg-orange-500/60'
                      : i % 6 === 4
                        ? 'bg-pink-500/60'
                        : 'bg-cyan-500/60'
            }`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              y: particleY,
            }}
            animate={{
              y: [-30, -60, -30],
              x: [-10, 10, -10],
              opacity: [0.4, 0.8, 0.4],
              scale: [0.5, 1.2, 0.5],
            }}
            transition={{
              duration: 8 + Math.random() * 4,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
              delay: Math.random() * 3,
            }}
          />
        ))}

        {/* Enhanced light rays with color variation */}
        <motion.div
          className="absolute top-0 left-1/4 w-0.5 h-full bg-gradient-to-b from-blue-500/30 via-transparent to-transparent"
          style={{ x: mouseXSlow }}
          animate={{
            opacity: [0.2, 0.4, 0.2],
            scaleX: [0.5, 1.2, 0.5],
          }}
          transition={{
            duration: 12,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
        />

        <motion.div
          className="absolute top-0 right-1/3 w-0.5 h-full bg-gradient-to-b from-purple-500/30 via-transparent to-transparent"
          style={{ x: mouseX }}
          animate={{
            opacity: [0.2, 0.4, 0.2],
            scaleX: [0.5, 1.2, 0.5],
          }}
          transition={{
            duration: 15,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
            delay: 3,
          }}
        />

        <motion.div
          className="absolute top-0 left-1/2 w-0.5 h-full bg-gradient-to-b from-orange-500/30 via-transparent to-transparent"
          style={{ x: mouseXFast }}
          animate={{
            opacity: [0.2, 0.4, 0.2],
            scaleX: [0.5, 1.2, 0.5],
          }}
          transition={{
            duration: 18,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
            delay: 6,
          }}
        />

        {/* Refined grid overlay with Refly brand color */}
        <motion.div
          className="absolute inset-0 opacity-8"
          style={{
            backgroundImage: `
              linear-gradient(rgba(14, 159, 119, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(14, 159, 119, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
            x: mouseXSlow,
            y: mouseYSlow,
          }}
          animate={{
            opacity: [0.05, 0.12, 0.05],
          }}
          transition={{
            duration: 6,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
        />
      </div>

      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-6 py-20"
        style={{
          y: headerY,
          scale: headerScale,
          opacity: headerOpacity,
        }}
      >
        {/* Enhanced Header Section with 3D Effects */}
        <motion.div className="text-center mb-24" variants={heroVariants}>
          {/* Premium Hero Icon with enhanced orbiting elements */}
          <motion.div
            className="inline-flex items-center justify-center mb-16"
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{
              type: 'spring' as const,
              stiffness: 80,
              damping: 20,
              delay: 0.8,
              duration: 2,
            }}
          >
            <div className="relative">
              <motion.div
                className="w-28 h-28 bg-gradient-to-r from-teal-500 via-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-xl"
                animate={{
                  boxShadow: [
                    '0 0 30px rgba(14, 159, 119, 0.3)',
                    '0 0 50px rgba(59, 130, 246, 0.4)',
                    '0 0 40px rgba(139, 92, 246, 0.3)',
                    '0 0 50px rgba(14, 159, 119, 0.5)',
                  ],
                  rotateY: [0, 360],
                }}
                transition={{
                  boxShadow: { duration: 8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
                  rotateY: { duration: 40, repeat: Number.POSITIVE_INFINITY, ease: 'linear' },
                }}
                whileHover={{ scale: 1.1, rotateX: 15, rotateZ: 3 }}
              >
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
                >
                  <RocketOutlined className="text-3xl text-white" />
                </motion.div>
              </motion.div>

              {/* Refined orbiting elements */}
              <OrbitingCircles
                className="w-3 h-3 border-none bg-gradient-to-r from-teal-400 to-blue-500"
                radius={60}
                duration={15}
              >
                <motion.div
                  className="w-3 h-3 bg-gradient-to-r from-teal-400 to-blue-500 rounded-full"
                  animate={{
                    scale: [1, 1.5, 1],
                    boxShadow: [
                      '0 0 8px rgba(14, 159, 119, 0.4)',
                      '0 0 15px rgba(59, 130, 246, 0.6)',
                      '0 0 8px rgba(14, 159, 119, 0.4)',
                    ],
                  }}
                  transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
                />
              </OrbitingCircles>
              <OrbitingCircles
                className="w-2.5 h-2.5 border-none bg-gradient-to-r from-purple-400 to-pink-500"
                radius={80}
                duration={22}
                reverse
                delay={8}
              >
                <motion.div
                  className="w-2.5 h-2.5 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full"
                  animate={{
                    scale: [1, 1.3, 1],
                    boxShadow: [
                      '0 0 6px rgba(139, 92, 246, 0.4)',
                      '0 0 12px rgba(236, 72, 153, 0.6)',
                      '0 0 6px rgba(139, 92, 246, 0.4)',
                    ],
                  }}
                  transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, delay: 2 }}
                />
              </OrbitingCircles>
              <OrbitingCircles
                className="w-2 h-2 border-none bg-gradient-to-r from-orange-400 to-yellow-500"
                radius={100}
                duration={30}
                delay={15}
              >
                <motion.div
                  className="w-2 h-2 bg-gradient-to-r from-orange-400 to-yellow-500 rounded-full"
                  animate={{
                    scale: [1, 1.8, 1],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, delay: 1 }}
                />
              </OrbitingCircles>
            </div>
          </motion.div>

          {/* Enhanced Title with refined text effects */}
          <motion.h1
            className="text-5xl md:text-7xl font-black mb-10 leading-tight perspective-1000"
            initial={{ opacity: 0, y: 60, rotateX: 30, z: -150 }}
            animate={{ opacity: 1, y: 0, rotateX: 0, z: 0 }}
            transition={{
              type: 'spring' as const,
              stiffness: 80,
              damping: 25,
              delay: 1.2,
              duration: 1.8,
            }}
          >
            <motion.span
              className="bg-gradient-to-r from-teal-600 via-blue-600 to-purple-600 bg-clip-text text-transparent block transform-gpu"
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                duration: 15,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
              }}
              style={{
                backgroundSize: '300% 100%',
                filter: 'drop-shadow(0 0 15px rgba(14, 159, 119, 0.3))',
              }}
              whileHover={{
                scale: 1.03,
                rotateY: 3,
                textShadow: '0 0 20px rgba(59, 130, 246, 0.4)',
              }}
            >
              🚀 有些名字，写在最初
            </motion.span>
            <motion.span
              className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent block transform-gpu"
              animate={{
                backgroundPosition: ['100% 50%', '0% 50%', '100% 50%'],
              }}
              transition={{
                duration: 15,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
                delay: 3,
              }}
              style={{
                backgroundSize: '300% 100%',
                filter: 'drop-shadow(0 0 15px rgba(139, 92, 246, 0.3))',
              }}
              whileHover={{
                scale: 1.03,
                rotateY: -3,
                textShadow: '0 0 20px rgba(236, 72, 153, 0.4)',
              }}
            >
              就不会被忘记
            </motion.span>
          </motion.h1>

          {/* Refined intro text */}
          <motion.div
            className="space-y-5 text-gray-700 text-lg max-w-2xl mx-auto mb-14"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.3,
                  delayChildren: 1.6,
                },
              },
            }}
          >
            <motion.p
              className="font-medium text-xl leading-relaxed"
              variants={{
                hidden: { opacity: 0, y: 30, rotateX: 15 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              whileHover={{
                scale: 1.02,
                color: '#0d9488',
                textShadow: '0 0 10px rgba(13, 148, 136, 0.3)',
              }}
            >
              他们是最早相信 Refly 的一群人，我们在此铭刻他们的名字
            </motion.p>
            <motion.p
              className="text-lg"
              variants={{
                hidden: { opacity: 0, y: 30, rotateX: 15 },
                visible: { opacity: 1, y: 0, rotateX: 0 },
              }}
              whileHover={{
                scale: 1.02,
                color: '#059669',
                textShadow: '0 0 10px rgba(5, 150, 105, 0.3)',
              }}
            >
              感谢这些早期创作者共同启航 Refly
            </motion.p>
          </motion.div>
        </motion.div>

        {/* Refined Current User Highlight with elegant effects */}
        {currentUser && (
          <motion.div
            className="bg-gradient-to-r from-white/80 via-teal-50/90 to-white/80 backdrop-blur-xl rounded-2xl p-8 mb-16 max-w-3xl mx-auto border border-teal-400/30 shadow-xl"
            initial={{ opacity: 0, y: 40, scale: 0.9, rotateX: 15 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            transition={{ delay: 2.3, duration: 1.2, type: 'spring' as const }}
            whileHover={{
              scale: 1.02,
              rotateY: 1,
              boxShadow: '0 20px 60px -10px rgba(14, 159, 119, 0.3)',
              borderColor: 'rgba(14, 159, 119, 0.5)',
            }}
            style={{
              background:
                'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 253, 250, 0.95) 50%, rgba(255, 255, 255, 0.9) 100%)',
            }}
          >
            <div className="flex items-center gap-6">
              <motion.div
                whileHover={{
                  scale: 1.1,
                  rotateY: 10,
                  z: 15,
                }}
                transition={{ type: 'spring' as const, stiffness: 300 }}
              >
                <div className="relative">
                  <motion.div
                    animate={{
                      boxShadow: [
                        '0 0 15px rgba(14, 159, 119, 0.4)',
                        '0 0 30px rgba(70, 192, 178, 0.6)',
                        '0 0 15px rgba(14, 159, 119, 0.4)',
                      ],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: 'easeInOut',
                    }}
                    className="rounded-full"
                  >
                    <Avatar
                      size={80}
                      src={currentUser.avatar}
                      className="transition-all duration-500 hover:shadow-xl ring-3 ring-teal-500/40"
                      // 添加默认文本作为备选
                      icon={
                        <span>{getSimplePinyin(currentUser.nickname || currentUser.name)}</span>
                      }
                      onError={() => {
                        // 当头像加载失败时，将选中成员的头像替换为生成的文本头像
                        setSelectedMember((prev) =>
                          prev
                            ? {
                                ...prev,
                                avatar: generateTextAvatar(prev.nickname || prev.name),
                              }
                            : null,
                        );
                        return true; // 返回true表示使用Ant Design的内置fallback
                      }}
                    />
                  </motion.div>
                  {/* Refined crown indicator */}
                  <motion.div
                    className="absolute -top-1 -right-1"
                    animate={{
                      y: [-3, -6, -3],
                      rotate: [0, 8, -8, 0],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: 'easeInOut',
                    }}
                  >
                    <div className="w-6 h-6 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md">
                      👑
                    </div>
                  </motion.div>
                </div>
              </motion.div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <motion.span
                    className="font-bold text-xl text-gray-800"
                    whileHover={{
                      scale: 1.03,
                      color: '#0d9488',
                      textShadow: '0 0 10px rgba(13, 148, 136, 0.4)',
                    }}
                  >
                    {currentUser.name}
                  </motion.span>
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 15, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
                    className="text-emerald-400"
                  >
                    <FireOutlined />
                  </motion.div>
                </div>
                <motion.div className="text-gray-600" whileHover={{ color: '#0891b2' }}>
                  <span className="font-medium text-teal-600 text-base">
                    {currentUser.nickname}
                  </span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Enhanced Avatar Wall with sophisticated grid effects */}
        <motion.div
          ref={avatarWallRef}
          className="mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.6, duration: 1.8 }}
        >
          <motion.div
            className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-16 gap-4 max-w-7xl mx-auto p-6 rounded-2xl"
            variants={avatarGridVariants}
            initial="hidden"
            animate="visible"
            style={{
              background:
                'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(240, 253, 250, 0.9) 50%, rgba(255, 255, 255, 0.8) 100%)',
              backdropFilter: 'blur(15px)',
              border: '1px solid rgba(14, 159, 119, 0.2)',
              boxShadow:
                '0 20px 40px -12px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            }}
          >
            <AnimatePresence>
              {visibleAvatars.map((member, index) => (
                <motion.div
                  key={member.id}
                  layoutId={member.id}
                  variants={avatarVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  className="relative cursor-pointer group flex flex-col items-center transform-gpu"
                  style={{
                    animationDelay: `${Math.floor(index / 16) * 0.08 + (index % 16) * 0.02}s`,
                  }}
                  onClick={() => setSelectedMember(member)}
                  onHoverStart={() => setHoveredAvatar(member.id)}
                  onHoverEnd={() => setHoveredAvatar(null)}
                >
                  <Tooltip
                    title={
                      <motion.div
                        className="text-center p-2 bg-gradient-to-r from-slate-800 to-teal-900 rounded-lg border border-teal-500/25"
                        initial={{ scale: 0.9, opacity: 0, rotateY: 15 }}
                        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                        transition={{ type: 'spring' as const, stiffness: 300 }}
                      >
                        <div className="font-medium text-white">{member.name}</div>
                        <div className="text-xs opacity-75 text-teal-300">{member.nickname}</div>
                      </motion.div>
                    }
                    placement="top"
                    color="transparent"
                  >
                    <div className="relative">
                      {/* Refined avatar with subtle effects */}
                      <motion.div
                        className="relative overflow-hidden rounded-full"
                        whileHover={{
                          boxShadow:
                            '0 0 25px rgba(14, 159, 119, 0.4), 0 0 40px rgba(70, 192, 178, 0.3)',
                          scale: 1.03,
                        }}
                      >
                        <motion.div
                          className="relative"
                          animate={{
                            boxShadow:
                              hoveredAvatar === member.id
                                ? [
                                    '0 0 15px rgba(14, 159, 119, 0.3)',
                                    '0 0 25px rgba(70, 192, 178, 0.5)',
                                    '0 0 15px rgba(14, 159, 119, 0.3)',
                                  ]
                                : '0 0 8px rgba(14, 159, 119, 0.2)',
                          }}
                          transition={{
                            duration: 3,
                            repeat: hoveredAvatar === member.id ? Number.POSITIVE_INFINITY : 0,
                            ease: 'easeInOut',
                          }}
                        >
                          <Avatar
                            size={56}
                            src={member.avatar}
                            className="transition-all duration-500 hover:shadow-lg ring-2 ring-teal-400/20 hover:ring-teal-400/40"
                            // 添加默认文本作为备选
                            icon={<span>{getSimplePinyin(member.nickname || member.name)}</span>}
                            onError={() => {
                              // 当头像加载失败时，将该成员的头像替换为生成的文本头像
                              const index = visibleAvatars.findIndex((m) => m.id === member.id);
                              if (index !== -1) {
                                const updatedAvatars = [...visibleAvatars];
                                updatedAvatars[index] = {
                                  ...updatedAvatars[index],
                                  avatar: generateTextAvatar(member.nickname || member.name),
                                };
                                setVisibleAvatars(updatedAvatars);
                              }
                              return true; // 返回true表示使用Ant Design的内置fallback
                            }}
                          />
                        </motion.div>

                        {/* Refined ripple effect */}
                        {hoveredAvatar === member.id && (
                          <React.Fragment>
                            <motion.div
                              className="absolute inset-0 rounded-full border-2 border-teal-400/50"
                              initial={{ scale: 1, opacity: 1 }}
                              animate={{ scale: 2, opacity: 0 }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                            <motion.div
                              className="absolute inset-0 rounded-full border-2 border-emerald-400/50"
                              initial={{ scale: 1, opacity: 1 }}
                              animate={{ scale: 1.6, opacity: 0 }}
                              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
                            />
                          </React.Fragment>
                        )}
                      </motion.div>

                      {/* Refined current user indicator */}
                      {member.isCurrentUser && (
                        <motion.div
                          className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-white text-xs px-3 py-1 rounded-full shadow-lg border border-yellow-300/40"
                          animate={{
                            scale: [1, 1.1, 1],
                            boxShadow: [
                              '0 0 0 0 rgba(251, 191, 36, 0.6)',
                              '0 0 0 10px rgba(251, 191, 36, 0)',
                              '0 0 0 0 rgba(251, 191, 36, 0)',
                            ],
                            y: [-2, -5, -2],
                          }}
                          transition={{
                            duration: 4,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: 'easeInOut',
                          }}
                        >
                          <motion.span
                            animate={{ rotate: [0, 8, -8, 0] }}
                            transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
                            className="font-medium"
                          >
                            你 👑
                          </motion.span>
                        </motion.div>
                      )}

                      {/* Subtle particle effects */}
                      {hoveredAvatar === member.id && (
                        <React.Fragment>
                          {Array.from({ length: 4 }).map((_, i) => (
                            <motion.div
                              key={i}
                              className="absolute w-1 h-1 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full"
                              style={{
                                top: `${25 + Math.random() * 50}%`,
                                left: `${25 + Math.random() * 50}%`,
                              }}
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{
                                scale: [0, 1.2, 0],
                                opacity: [0, 0.8, 0],
                                y: [-15, -30, -45],
                                x: [0, Math.random() * 15 - 7.5, 0],
                              }}
                              transition={{
                                duration: 1.5,
                                repeat: Number.POSITIVE_INFINITY,
                                delay: i * 0.2,
                                ease: 'easeOut',
                              }}
                            />
                          ))}
                        </React.Fragment>
                      )}
                    </div>
                  </Tooltip>

                  {/* Refined nickname display */}
                  <motion.div
                    className="mt-2 text-xs text-center text-gray-600 font-medium truncate w-full px-1"
                    whileHover={{
                      color: '#0d9488',
                      scale: 1.03,
                      textShadow: '0 0 8px rgba(13, 148, 136, 0.4)',
                    }}
                  >
                    {member.nickname}
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* Refined Share Section */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 50, scale: 0.9, rotateX: 15 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
          transition={{
            delay: 2.8,
            duration: 1.2,
            type: 'spring' as const,
            stiffness: 120,
          }}
        >
          <motion.div whileHover={{ scale: 1.05, rotateY: 3 }} whileTap={{ scale: 0.97 }}>
            <PulsatingButton
              className="bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 hover:from-teal-700 hover:via-emerald-700 hover:to-cyan-700 text-white font-bold px-10 py-4 rounded-xl shadow-lg transition-all duration-500 text-lg border border-teal-400/30"
              pulseColor="14, 159, 119"
              onClick={() => setShareModalVisible(true)}
              style={{
                background: 'linear-gradient(135deg, #0e9f77 0%, #10b981 50%, #06b6d4 100%)',
                boxShadow: '0 0 20px rgba(14, 159, 119, 0.3), 0 15px 30px -8px rgba(0, 0, 0, 0.3)',
              }}
            >
              <motion.div
                animate={{
                  rotate: [0, 12, -12, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 8,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                }}
                className="inline-block mr-3"
              >
                <ShareAltOutlined className="text-xl" />
              </motion.div>
              我的头像也在上面 🎉 去分享！
            </PulsatingButton>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Refined Member Detail Modal with Refly Theme */}
      <Modal
        title={null}
        open={!!selectedMember}
        onCancel={() => setSelectedMember(null)}
        footer={null}
        width={450}
        className="member-detail-modal"
        styles={{
          body: { padding: 0 },
          content: {
            background:
              'linear-gradient(135deg, rgba(240, 253, 250, 0.98) 0%, rgba(204, 251, 241, 0.95) 25%, rgba(167, 243, 208, 0.3) 50%, rgba(204, 251, 241, 0.95) 75%, rgba(240, 253, 250, 0.98) 100%)',
            backdropFilter: 'blur(30px)',
            borderRadius: '24px',
            border: '1px solid rgba(14, 159, 119, 0.3)',
            boxShadow:
              '0 25px 60px -10px rgba(0, 0, 0, 0.15), 0 0 30px rgba(14, 159, 119, 0.2), 0 0 15px rgba(70, 192, 178, 0.1)',
          },
        }}
        destroyOnClose
      >
        <AnimatePresence>
          {selectedMember && (
            <motion.div
              className="p-8"
              initial={{ opacity: 0, scale: 0.8, rotateY: 60, z: -80 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0, z: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotateY: -60, z: -80 }}
              transition={{
                type: 'spring' as const,
                stiffness: 180,
                damping: 25,
                duration: 0.6,
              }}
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0, rotate: 120, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring' as const, stiffness: 250 }}
                  whileHover={{ scale: 1.1, rotateY: 15, rotateX: 8 }}
                >
                  <div className="relative inline-block">
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 0 20px rgba(14, 159, 119, 0.3)',
                          '0 0 40px rgba(70, 192, 178, 0.5)',
                          '0 0 20px rgba(14, 159, 119, 0.3)',
                        ],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: 'easeInOut',
                      }}
                      className="rounded-full"
                    >
                      <Avatar
                        size={100}
                        src={selectedMember.avatar}
                        className="transition-all duration-500 hover:shadow-xl ring-3 ring-teal-400/40 hover:ring-teal-400/60"
                        // 添加默认文本作为备选
                        icon={
                          <span>
                            {getSimplePinyin(selectedMember.nickname || selectedMember.name)}
                          </span>
                        }
                        onError={() => {
                          // 当头像加载失败时，将选中成员的头像替换为生成的文本头像
                          setSelectedMember((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  avatar: generateTextAvatar(prev.nickname || prev.name),
                                }
                              : null,
                          );
                          return true; // 返回true表示使用Ant Design的内置fallback
                        }}
                      />
                    </motion.div>
                    {/* Harmonious floating elements with Refly theme */}
                    {Array.from({ length: 3 }).map((_, i) => (
                      <motion.div
                        key={i}
                        className={`absolute w-1.5 h-1.5 rounded-full ${
                          i === 0
                            ? 'bg-gradient-to-r from-teal-400 to-emerald-400'
                            : i === 1
                              ? 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                              : 'bg-gradient-to-r from-cyan-400 to-teal-500'
                        }`}
                        style={{
                          top: `${20 + Math.random() * 60}%`,
                          left: `${20 + Math.random() * 60}%`,
                        }}
                        animate={{
                          y: [-8, -16, -8],
                          x: [0, Math.random() * 8 - 4, 0],
                          opacity: [0.4, 0.8, 0.4],
                          scale: [0.8, 1.3, 0.8],
                        }}
                        transition={{
                          duration: 4 + Math.random() * 2,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: 'easeInOut',
                          delay: i * 0.8,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
                <motion.h3
                  className="text-2xl font-bold text-gray-800 mb-2 mt-5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  whileHover={{
                    scale: 1.03,
                    textShadow: '0 0 15px rgba(14, 159, 119, 0.4)',
                  }}
                >
                  {selectedMember.name}
                </motion.h3>
                <motion.p
                  className="text-teal-600 text-base"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  早鸟创作者
                </motion.p>
              </div>

              <motion.div
                className="space-y-4"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1,
                      delayChildren: 0.6,
                    },
                  },
                }}
                initial="hidden"
                animate="visible"
              >
                <motion.div
                  className="flex justify-between py-3 px-5 bg-gradient-to-r from-white/70 to-teal-50/70 rounded-xl border border-teal-400/20"
                  variants={{
                    hidden: { opacity: 0, x: -20, rotateX: 15 },
                    visible: { opacity: 1, x: 0, rotateX: 0 },
                  }}
                  whileHover={{
                    scale: 1.02,
                    backgroundColor: 'rgba(14, 159, 119, 0.1)',
                    borderColor: 'rgba(14, 159, 119, 0.4)',
                    boxShadow: '0 8px 25px -5px rgba(14, 159, 119, 0.2)',
                  }}
                >
                  <span className="font-medium text-gray-600">用户名</span>
                  <span className="font-bold text-gray-800">{selectedMember.name}</span>
                </motion.div>
                <motion.div
                  className="flex justify-between py-3 px-5 bg-gradient-to-r from-white/70 to-teal-50/70 rounded-xl border border-teal-400/20"
                  variants={{
                    hidden: { opacity: 0, x: -20, rotateX: 15 },
                    visible: { opacity: 1, x: 0, rotateX: 0 },
                  }}
                  whileHover={{
                    scale: 1.02,
                    backgroundColor: 'rgba(14, 159, 119, 0.1)',
                    borderColor: 'rgba(14, 159, 119, 0.4)',
                    boxShadow: '0 8px 25px -5px rgba(14, 159, 119, 0.2)',
                  }}
                >
                  <span className="font-medium text-gray-600">昵称</span>
                  <span className="font-bold text-teal-700">{selectedMember.nickname}</span>
                </motion.div>
                <motion.div
                  className="flex justify-between py-3 px-5 bg-gradient-to-r from-white/70 to-teal-50/70 rounded-xl border border-teal-400/20"
                  variants={{
                    hidden: { opacity: 0, x: -20, rotateX: 15 },
                    visible: { opacity: 1, x: 0, rotateX: 0 },
                  }}
                  whileHover={{
                    scale: 1.02,
                    backgroundColor: 'rgba(14, 159, 119, 0.1)',
                    borderColor: 'rgba(14, 159, 119, 0.4)',
                    boxShadow: '0 8px 25px -5px rgba(14, 159, 119, 0.2)',
                  }}
                >
                  <span className="font-medium text-gray-600">身份</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-2">
                    早期用户
                    <motion.span
                      animate={{ rotate: [0, 360] }}
                      transition={{
                        duration: 12,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: 'linear',
                      }}
                    >
                      ⭐
                    </motion.span>
                  </span>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>

      {/* Refined Share Modal with Refly Theme */}
      <Modal
        title={null}
        open={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        footer={null}
        width={550}
        className="share-modal"
        styles={{
          content: {
            background:
              'linear-gradient(135deg, rgba(240, 253, 250, 0.98) 0%, rgba(204, 251, 241, 0.95) 25%, rgba(167, 243, 208, 0.3) 50%, rgba(204, 251, 241, 0.95) 75%, rgba(240, 253, 250, 0.98) 100%)',
            backdropFilter: 'blur(30px)',
            borderRadius: '24px',
            border: '1px solid rgba(14, 159, 119, 0.3)',
            boxShadow:
              '0 25px 60px -10px rgba(0, 0, 0, 0.15), 0 0 30px rgba(14, 159, 119, 0.2), 0 0 15px rgba(70, 192, 178, 0.1)',
          },
        }}
      >
        <AnimatePresence>
          {shareModalVisible && (
            <motion.div
              className="space-y-8 p-5"
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.9 }}
              transition={{ type: 'spring' as const, stiffness: 180, damping: 25 }}
            >
              {/* Modal Header */}
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <motion.h2
                  className="text-2xl font-bold bg-gradient-to-r from-teal-400 via-emerald-500 to-cyan-400 bg-clip-text text-transparent mb-2"
                  whileHover={{
                    scale: 1.03,
                    textShadow: '0 0 15px rgba(14, 159, 119, 0.4)',
                  }}
                >
                  分享你的早鸟身份
                </motion.h2>
                <p className="text-gray-600 text-base">向世界展示你的创作者身份</p>
              </motion.div>

              {/* Refined Share Image Preview */}
              <motion.div
                ref={shareImageRef}
                className="bg-gradient-to-br from-slate-800 via-teal-900 to-slate-800 rounded-2xl p-10 text-center shadow-xl border border-teal-500/20"
                style={{ width: '450px', height: '500px', margin: '0 auto' }}
                initial={{ scale: 0.8, opacity: 0, rotateY: 15 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                transition={{ delay: 0.3, type: 'spring' as const }}
                whileHover={{ scale: 1.02, rotateY: 1 }}
              >
                <div className="mb-8">
                  <motion.div
                    initial={{ scale: 0, rotate: 120 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.5, type: 'spring' as const, stiffness: 200 }}
                  >
                    <div className="relative inline-block">
                      <motion.div
                        animate={{
                          boxShadow: [
                            '0 0 30px rgba(14, 159, 119, 0.4)',
                            '0 0 50px rgba(70, 192, 178, 0.6)',
                            '0 0 30px rgba(14, 159, 119, 0.4)',
                          ],
                        }}
                        transition={{
                          duration: 5,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: 'easeInOut',
                        }}
                        className="rounded-full"
                      >
                        <Avatar
                          size={120}
                          src={currentUser.avatar}
                          className="mx-auto mb-6 ring-4 ring-teal-400/40 ring-offset-4 ring-offset-slate-800 shadow-xl"
                          onError={() => {
                            // 当分享模态框中头像加载失败时，使用生成的文本头像
                            const updatedUser = {
                              ...currentUser,
                              avatar: generateTextAvatar(currentUser.nickname || currentUser.name),
                            };
                            // 更新当前用户的头像
                            const updatedUsers = visibleAvatars.map((user) =>
                              user.id === currentUser.id ? updatedUser : user,
                            );
                            setVisibleAvatars(updatedUsers);
                            return false; // 返回false以符合Ant Design的要求
                          }}
                        />
                      </motion.div>
                      {/* Harmonious orbiting elements with Refly theme */}
                      {Array.from({ length: 2 }).map((_, i) => (
                        <motion.div
                          key={i}
                          className={`absolute w-2 h-2 rounded-full ${
                            i === 0
                              ? 'bg-gradient-to-r from-teal-400 to-emerald-400'
                              : 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                          }`}
                          style={{
                            top: `${25 + i * 25}%`,
                            left: `${15 + i * 35}%`,
                          }}
                          animate={{
                            rotate: [0, 360],
                            scale: [0.8, 1.2, 0.8],
                          }}
                          transition={{
                            duration: 6 + i * 2,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: 'linear',
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                  <motion.h3
                    className="text-3xl font-bold text-white mb-3"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                  >
                    {currentUser.name}
                  </motion.h3>
                </div>

                <motion.div
                  className="bg-gradient-to-r from-slate-700/70 to-teal-800/70 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg border border-teal-400/20"
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.9 }}
                >
                  <motion.div
                    className="text-4xl font-bold bg-gradient-to-r from-teal-400 via-emerald-500 to-cyan-400 bg-clip-text text-transparent mb-2"
                    animate={{
                      textShadow: [
                        '0 0 15px rgba(14, 159, 119, 0.4)',
                        '0 0 25px rgba(16, 185, 129, 0.5)',
                        '0 0 20px rgba(6, 182, 212, 0.4)',
                        '0 0 15px rgba(14, 159, 119, 0.4)',
                      ],
                    }}
                    transition={{
                      duration: 6,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: 'easeInOut',
                    }}
                  >
                    #
                    {Array.from(currentUser.name).reduce(
                      (acc, char) => acc + char.charCodeAt(0),
                      0,
                    ) % 1000}
                  </motion.div>
                  <div className="text-teal-300 font-medium text-base">早鸟编号</div>
                </motion.div>

                <motion.div
                  className="text-gray-200 leading-relaxed space-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1 }}
                >
                  <p className="font-medium text-lg">曾在黎明前按下启动键</p>
                  <p className="font-medium text-lg">也在无声处埋下信念</p>
                  <p className="font-medium text-lg">向每一位创造者致敬，未来一起继续飞</p>
                  <motion.p
                    className="font-bold text-xl bg-gradient-to-r from-teal-400 to-emerald-500 bg-clip-text text-transparent mt-5"
                    animate={{
                      scale: [1, 1.03, 1],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: 'easeInOut',
                    }}
                  >
                    🚀 refly.ai
                  </motion.p>
                </motion.div>
              </motion.div>

              {/* Refined Download Button */}
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 }}
              >
                <ShimmerButton
                  className="bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 hover:from-teal-700 hover:via-emerald-700 hover:to-cyan-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg border border-teal-400/30"
                  onClick={generateShareImage}
                  style={{
                    background: 'linear-gradient(135deg, #0e9f77 0%, #10b981 50%, #06b6d4 100%)',
                    boxShadow:
                      '0 0 20px rgba(14, 159, 119, 0.3), 0 15px 30px -8px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <motion.span
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
                    className="inline-block mr-2 text-xl"
                  >
                    💾
                  </motion.span>
                  下载分享图片
                </ShimmerButton>
              </motion.div>

              {/* Refined Social Share Options */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 }}
              >
                <h4 className="text-xl font-bold text-gray-800 mb-6 text-center">分享到社交平台</h4>
                <motion.div
                  className="grid grid-cols-5 gap-4"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.08,
                        delayChildren: 1.6,
                      },
                    },
                  }}
                  initial="hidden"
                  animate="visible"
                >
                  {[
                    {
                      name: '微信好友',
                      key: 'wechat',
                      color: 'from-green-500 to-green-600',
                      emoji: '💬',
                    },
                    {
                      name: '小红书',
                      key: 'xiaohongshu',
                      color: 'from-red-500 to-red-600',
                      emoji: '📱',
                    },
                    { name: 'X', key: 'twitter', color: 'from-gray-800 to-black', emoji: '🐦' },
                    {
                      name: 'Discord',
                      key: 'discord',
                      color: 'from-indigo-500 to-indigo-600',
                      emoji: '🎮',
                    },
                    {
                      name: 'Telegram',
                      key: 'telegram',
                      color: 'from-blue-500 to-blue-600',
                      emoji: '✈️',
                    },
                  ].map((platform) => (
                    <motion.div
                      key={platform.key}
                      variants={{
                        hidden: { opacity: 0, y: 20, scale: 0.8 },
                        visible: { opacity: 1, y: 0, scale: 1 },
                      }}
                      whileHover={{
                        scale: 1.1,
                        y: -5,
                        rotateY: 8,
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        className={`bg-gradient-to-r ${platform.color} text-white border-none hover:opacity-90 transition-all rounded-xl h-16 flex flex-col items-center justify-center font-medium shadow-lg border border-white/10`}
                        onClick={() => shareToSocial(platform.name)}
                        style={{
                          boxShadow: '0 8px 20px -5px rgba(0, 0, 0, 0.25)',
                        }}
                      >
                        <motion.span
                          className="text-lg mb-1"
                          animate={{
                            rotate: [0, 10, -10, 0],
                            scale: [1, 1.05, 1],
                          }}
                          transition={{
                            duration: 5,
                            repeat: Number.POSITIVE_INFINITY,
                            delay: Math.random() * 3,
                            ease: 'easeInOut',
                          }}
                        >
                          {platform.emoji}
                        </motion.span>
                        <span className="text-xs font-medium">{platform.name}</span>
                      </Button>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>
    </motion.div>
  );
};

export default MemorialPage;
