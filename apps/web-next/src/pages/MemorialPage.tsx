import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button, Avatar, Modal, message, Tooltip } from 'antd';
import {
  ShareAltOutlined,
  StarOutlined,
  HeartOutlined,
  ThunderboltOutlined,
  CrownOutlined,
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
import {
  PulsatingButton,
  ShimmerButton,
  AnimatedCircularProgressBar,
  OrbitingCircles,
} from '../components/magicui';
import './MemorialPage.css';

interface Member {
  id: string;
  name: string;
  avatar: string;
  joinDate: string;
  badge: 'legendary' | 'founder' | 'pioneer' | 'supporter';
  tier: 'diamond' | 'platinum' | 'gold' | 'silver';
  wallNumber: number;
  contributions: number;
  isCurrentUser?: boolean;
}

const MemorialPage: React.FC = () => {
  const [visibleAvatars, setVisibleAvatars] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredAvatar, setHoveredAvatar] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shareImageRef = useRef<HTMLDivElement>(null);

  // Generate mock early bird users
  const earlyBirdUsers = useMemo(() => generateEarlyBirdUsers(), []);

  // Find current user (simulated)
  const currentUser = useMemo(
    () => earlyBirdUsers.find((user) => user.id === 'current-user') || earlyBirdUsers[0],
    [earlyBirdUsers],
  );

  // Advanced scroll-based animations
  const { scrollY } = useScroll();
  const headerY = useTransform(scrollY, [0, 300], [0, -50]);
  const headerScale = useTransform(scrollY, [0, 200], [1, 0.95]);
  const headerOpacity = useTransform(scrollY, [0, 150], [1, 0.8]);

  // Premium mouse parallax with multiple layers
  const mouseX = useSpring(0, { stiffness: 50, damping: 30 });
  const mouseY = useSpring(0, { stiffness: 50, damping: 30 });
  const mouseXFast = useSpring(0, { stiffness: 100, damping: 25 });
  const mouseYFast = useSpring(0, { stiffness: 100, damping: 25 });

  // Time-based animations
  const time = useTime();
  const rotateX = useTransform(time, [0, 4000], [0, 360], { clamp: false });
  const rotateY = useTransform(time, [0, 6000], [0, 360], { clamp: false });

  // Advanced badge and tier styles with gradients
  const badgeStyles = {
    legendary:
      'bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 text-white shadow-xl border border-amber-300/30 animate-pulse',
    founder:
      'bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 text-white shadow-xl border border-teal-300/30',
    pioneer:
      'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white shadow-xl border border-blue-300/30',
    supporter:
      'bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 text-white shadow-xl border border-pink-300/30',
  };

  const tierStyles = {
    diamond: 'ring-4 ring-teal-400/40 shadow-2xl shadow-teal-500/20 hover:ring-teal-400/60',
    platinum: 'ring-4 ring-gray-300/40 shadow-2xl shadow-gray-500/20 hover:ring-gray-300/60',
    gold: 'ring-4 ring-yellow-400/40 shadow-2xl shadow-yellow-500/20 hover:ring-yellow-400/60',
    silver: 'ring-4 ring-gray-400/40 shadow-2xl shadow-gray-400/20 hover:ring-gray-400/60',
  };

  // Premium animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 1.2,
        staggerChildren: 0.08,
        delayChildren: 0.2,
      },
    },
  };

  const heroVariants = {
    hidden: {
      opacity: 0,
      y: 60,
      scale: 0.8,
      rotateX: -15,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotateX: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 120,
        damping: 20,
        duration: 1.5,
      },
    },
  };

  const avatarVariants = {
    hidden: {
      opacity: 0,
      scale: 0,
      y: 100,
      rotateY: 180,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      rotateY: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 200,
        damping: 20,
        duration: 0.8,
      },
    },
    hover: {
      scale: 1.2,
      y: -8,
      rotateY: 10,
      rotateX: 5,
      transition: {
        type: 'spring' as const,
        stiffness: 400,
        damping: 15,
      },
    },
  };

  function generateEarlyBirdUsers(): Member[] {
    const badges: Array<'legendary' | 'founder' | 'pioneer' | 'supporter'> = [
      'legendary',
      'founder',
      'pioneer',
      'supporter',
    ];
    const tiers: Array<'diamond' | 'platinum' | 'gold' | 'silver'> = [
      'diamond',
      'platinum',
      'gold',
      'silver',
    ];
    const names = [
      'Alex Chen',
      'Sarah Kim',
      'Michael Zhang',
      'Emily Wang',
      'David Liu',
      'Jessica Wu',
      'Ryan Park',
      'Anna Li',
      'Kevin Zhao',
      'Maya Patel',
      'Chris Yang',
      'Sophie Lin',
      'Jason Wu',
      'Chloe Kim',
      'Eric Chen',
      'Lily Zhang',
      'Tom Wang',
      'Grace Liu',
      'Daniel Park',
      'Amy Lin',
      'Steven Kim',
      'Mia Chen',
      'Oliver Zhang',
      'Eva Wang',
    ];

    return Array.from({ length: 215 }, (_, index) => {
      const isCurrentUser = index === 42;
      const badge = badges[Math.floor(Math.random() * badges.length)];
      const tier = tiers[Math.floor(Math.random() * tiers.length)];

      return {
        id: isCurrentUser ? 'current-user' : `user-${index}`,
        name: isCurrentUser ? '当前用户' : names[index % names.length],
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${index}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`,
        joinDate: new Date(2024, 0, Math.floor(Math.random() * 90) + 1).toISOString().split('T')[0],
        badge,
        tier,
        wallNumber: index + 1,
        contributions: Math.floor(Math.random() * 100) + 10,
        isCurrentUser,
      };
    });
  }

  // Enhanced mouse move handler with multiple parallax layers
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (event.clientY - rect.top - rect.height / 2) / rect.height;

      mouseX.set(x * 20);
      mouseY.set(y * 20);
      mouseXFast.set(x * 40);
      mouseYFast.set(y * 40);
    },
    [mouseX, mouseY, mouseXFast, mouseYFast],
  );

  // Enhanced avatar loading with wave animation
  useEffect(() => {
    const loadAvatars = () => {
      const batchSize = 12;
      let currentIndex = 0;

      const loadNextBatch = () => {
        const nextBatch = earlyBirdUsers.slice(currentIndex, currentIndex + batchSize);
        setVisibleAvatars((prev) => [...prev, ...nextBatch]);
        currentIndex += batchSize;

        if (currentIndex < earlyBirdUsers.length) {
          setTimeout(loadNextBatch, 80);
        } else {
          setIsLoading(false);
        }
      };

      setTimeout(loadNextBatch, 800);
    };

    loadAvatars();
  }, [earlyBirdUsers]);

  const getBadgeIcon = (badge: string) => {
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
      link.download = `refly-early-bird-${currentUser.wallNumber}.png`;
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
      className="min-h-screen bg-gradient-to-br from-white via-slate-50/30 to-white relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      onMouseMove={handleMouseMove}
    >
      {/* Enhanced Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Premium gradient orbs with enhanced effects */}
        <motion.div
          className="absolute w-96 h-96 bg-gradient-to-r from-teal-200/60 via-emerald-200/60 to-green-200/60 rounded-full blur-3xl"
          style={{
            top: '5%',
            right: '10%',
            x: mouseX,
            y: mouseY,
            rotateX,
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            scale: { duration: 8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
            opacity: { duration: 5, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
          }}
        />

        <motion.div
          className="absolute w-80 h-80 bg-gradient-to-r from-purple-200/50 via-pink-200/50 to-rose-200/50 rounded-full blur-3xl"
          style={{
            bottom: '10%',
            left: '5%',
            x: mouseXFast,
            y: mouseYFast,
            rotateY,
          }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            scale: { duration: 12, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
            opacity: { duration: 8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
          }}
        />

        {/* Enhanced floating particles system */}
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-2 h-2 rounded-full ${
              i % 3 === 0 ? 'bg-teal-400/40' : i % 3 === 1 ? 'bg-emerald-400/40' : 'bg-green-400/40'
            }`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [-30, -60, -30],
              x: [-10, 10, -10],
              opacity: [0.2, 0.8, 0.2],
              scale: [0.5, 1.5, 0.5],
            }}
            transition={{
              duration: 4 + Math.random() * 4,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
              delay: Math.random() * 3,
            }}
          />
        ))}

        {/* Premium light rays */}
        <motion.div
          className="absolute top-0 left-1/2 w-1 h-full bg-gradient-to-b from-teal-400/20 via-transparent to-transparent"
          style={{ x: mouseX }}
          animate={{
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 6,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
        />
      </div>

      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-6 py-16"
        style={{
          y: headerY,
          scale: headerScale,
          opacity: headerOpacity,
        }}
      >
        {/* Enhanced Header Section */}
        <motion.div className="text-center mb-20" variants={heroVariants}>
          {/* Premium Hero Icon with orbiting elements */}
          <motion.div
            className="inline-flex items-center justify-center mb-12"
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{
              type: 'spring' as const,
              stiffness: 100,
              damping: 15,
              delay: 0.5,
              duration: 1.5,
            }}
          >
            <div className="relative">
              <motion.div
                className="w-24 h-24 bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 rounded-2xl flex items-center justify-center shadow-2xl"
                animate={{
                  boxShadow: [
                    '0 10px 40px -10px rgba(0, 212, 170, 0.3)',
                    '0 30px 60px -15px rgba(0, 212, 170, 0.5)',
                    '0 10px 40px -10px rgba(0, 212, 170, 0.3)',
                  ],
                  rotateY: [0, 360],
                }}
                transition={{
                  boxShadow: { duration: 4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
                  rotateY: { duration: 20, repeat: Number.POSITIVE_INFINITY, ease: 'linear' },
                }}
                whileHover={{ scale: 1.1, rotateX: 15 }}
              >
                <StarOutlined className="text-3xl text-white" />
              </motion.div>

              {/* Orbiting elements */}
              <OrbitingCircles
                className="w-3 h-3 border-none bg-teal-400"
                radius={50}
                duration={10}
              >
                <motion.div
                  className="w-3 h-3 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                />
              </OrbitingCircles>
              <OrbitingCircles
                className="w-2 h-2 border-none bg-emerald-400"
                radius={65}
                duration={15}
                reverse
                delay={5}
              >
                <motion.div
                  className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-green-400 rounded-full"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, delay: 1 }}
                />
              </OrbitingCircles>
            </div>
          </motion.div>

          {/* Enhanced Title with 3D text effects */}
          <motion.h1
            className="text-5xl md:text-7xl font-bold mb-8 leading-tight perspective-1000"
            initial={{ opacity: 0, y: 50, rotateX: 30 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{
              type: 'spring' as const,
              stiffness: 60,
              damping: 20,
              delay: 0.8,
              duration: 1.5,
            }}
          >
            <motion.span
              className="bg-gradient-to-r from-gray-800 via-gray-900 to-black bg-clip-text text-transparent block transform-gpu"
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                duration: 8,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
              }}
              style={{ backgroundSize: '300% 100%' }}
              whileHover={{
                scale: 1.05,
                textShadow: '0 0 20px rgba(0,0,0,0.3)',
              }}
            >
              🎉 有些名字，写在最初
            </motion.span>
            <motion.span
              className="bg-gradient-to-r from-teal-600 via-emerald-600 to-green-600 bg-clip-text text-transparent block transform-gpu"
              animate={{
                backgroundPosition: ['100% 50%', '0% 50%', '100% 50%'],
              }}
              transition={{
                duration: 8,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
                delay: 1,
              }}
              style={{ backgroundSize: '300% 100%' }}
              whileHover={{
                scale: 1.05,
                textShadow: '0 0 20px rgba(0,212,170,0.3)',
              }}
            >
              就不会被忘记
            </motion.span>
          </motion.h1>

          {/* Enhanced intro text with stagger animation */}
          <motion.div
            className="space-y-4 text-gray-600 text-lg max-w-2xl mx-auto mb-12"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.3,
                  delayChildren: 1.2,
                },
              },
            }}
          >
            <motion.p
              className="font-medium text-xl"
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0 },
              }}
              whileHover={{ scale: 1.02, color: '#0d9488' }}
            >
              他们是最早相信 Refly 的一群人，我们在此铭刻他们的名字
            </motion.p>
            <motion.p
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0 },
              }}
              whileHover={{ scale: 1.02, color: '#059669' }}
            >
              感谢这些早期创作者共同启航 Refly
            </motion.p>
          </motion.div>

          {/* Enhanced Progress Stats with 3D effects */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-12 mb-12"
            initial={{ opacity: 0, scale: 0.8, rotateX: 20 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{
              delay: 1.5,
              duration: 1,
              type: 'spring' as const,
              stiffness: 100,
            }}
          >
            <motion.div
              className="flex items-center gap-6"
              whileHover={{ scale: 1.05, rotateY: 5 }}
              animate={{
                y: [-20, -30, -20],
                x: [-5, 5, -5],
                rotate: [-2, 2, -2],
              }}
              transition={{
                duration: 6,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              }}
            >
              <div className="relative">
                <AnimatedCircularProgressBar
                  max={1000}
                  value={215}
                  min={0}
                  gaugePrimaryColor="#00D4AA"
                  gaugeSecondaryColor="#e5e7eb"
                  className="w-24 h-24"
                />
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(0, 212, 170, 0.3)',
                      '0 0 40px rgba(0, 212, 170, 0.6)',
                      '0 0 20px rgba(0, 212, 170, 0.3)',
                    ],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'easeInOut',
                  }}
                />
              </div>
              <div className="text-left">
                <motion.div
                  className="text-3xl font-bold text-gray-900"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                >
                  215
                </motion.div>
                <div className="text-sm text-gray-500">早鸟用户</div>
              </div>
            </motion.div>

            <motion.div
              className="text-center"
              whileHover={{ scale: 1.05, rotateY: -5 }}
              animate={{
                y: [-20, -30, -20],
                x: [-5, 5, -5],
                rotate: [-2, 2, -2],
              }}
              transition={{
                duration: 6,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
                delay: 1,
              }}
            >
              <motion.div
                className="text-2xl font-semibold text-teal-600"
                animate={{
                  color: ['#0d9488', '#10b981', '#059669', '#0d9488'],
                }}
                transition={{
                  duration: 4,
                  repeat: Number.POSITIVE_INFINITY,
                }}
              >
                21.5%
              </motion.div>
              <div className="text-sm text-gray-500">完成度</div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Enhanced Current User Highlight */}
        {currentUser && (
          <motion.div
            className="bg-gradient-to-r from-teal-50/80 via-emerald-50/80 to-green-50/80 backdrop-blur-sm rounded-3xl p-8 mb-16 max-w-3xl mx-auto border border-teal-200/50 shadow-2xl"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1.8, duration: 1, type: 'spring' as const }}
            whileHover={{
              scale: 1.02,
              boxShadow: '0 25px 50px -12px rgba(0, 212, 170, 0.25)',
            }}
          >
            <div className="flex items-center gap-6">
              <motion.div
                whileHover={{ scale: 1.1, rotateY: 10 }}
                transition={{ type: 'spring' as const, stiffness: 300 }}
              >
                <Avatar
                  size={80}
                  src={currentUser.avatar}
                  className={`${tierStyles[currentUser.tier]} transition-all duration-500 hover:shadow-2xl`}
                />
              </motion.div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <motion.span
                    className="font-bold text-xl text-gray-900"
                    whileHover={{ scale: 1.05, color: '#0d9488' }}
                  >
                    {currentUser.name}
                  </motion.span>
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: 'spring' as const, stiffness: 300 }}
                  >
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${badgeStyles[currentUser.badge]}`}
                    >
                      {getBadgeIcon(currentUser.badge)}
                      <span>{currentUser.badge.toUpperCase()}</span>
                    </div>
                  </motion.div>
                </div>
                <motion.div className="text-gray-600" whileHover={{ color: '#374151' }}>
                  第 <span className="font-bold text-teal-600">{currentUser.wallNumber}</span>{' '}
                  位早鸟 • 贡献值{' '}
                  <span className="font-bold text-emerald-600">{currentUser.contributions}</span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Enhanced Avatar Wall with wave animation */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1.5 }}
        >
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-15 gap-4 max-w-6xl mx-auto">
            <AnimatePresence>
              {visibleAvatars.map((member, index) => (
                <motion.div
                  key={member.id}
                  layoutId={member.id}
                  variants={avatarVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  className="relative cursor-pointer group"
                  style={{
                    animationDelay: `${Math.floor(index / 12) * 0.1 + (index % 12) * 0.05}s`,
                  }}
                  onClick={() => setSelectedMember(member)}
                  onHoverStart={() => setHoveredAvatar(member.id)}
                  onHoverEnd={() => setHoveredAvatar(null)}
                >
                  <Tooltip
                    title={
                      <motion.div
                        className="text-center p-2"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring' as const, stiffness: 200 }}
                      >
                        <div className="font-medium text-lg">{member.name}</div>
                        <div className="text-xs opacity-75">第 {member.wallNumber} 位早鸟</div>
                        <div className="text-xs opacity-75 font-semibold">
                          {member.badge.toUpperCase()}
                        </div>
                      </motion.div>
                    }
                    placement="top"
                  >
                    <div className="relative">
                      {/* Enhanced avatar with ripple effect */}
                      <motion.div
                        className="relative overflow-hidden rounded-full"
                        whileHover={{
                          boxShadow: '0 20px 40px -10px rgba(0, 212, 170, 0.4)',
                        }}
                      >
                        <Avatar
                          size={56}
                          src={member.avatar}
                          className={`
                            ${tierStyles[member.tier]} 
                            ${member.isCurrentUser ? 'ring-4 ring-teal-400/60 ring-offset-2' : ''}
                            transition-all duration-500 hover:shadow-2xl
                          `}
                        />

                        {/* Ripple effect on hover */}
                        {hoveredAvatar === member.id && (
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-teal-400"
                            initial={{ scale: 1, opacity: 1 }}
                            animate={{ scale: 2, opacity: 0 }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                          />
                        )}
                      </motion.div>

                      {/* Enhanced badge indicator with glow */}
                      <motion.div
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow-lg flex items-center justify-center text-xs border-2 border-white"
                        whileHover={{
                          scale: 1.2,
                          boxShadow: '0 0 15px rgba(0, 212, 170, 0.6)',
                        }}
                        transition={{ type: 'spring' as const, stiffness: 300 }}
                      >
                        {getBadgeIcon(member.badge)}
                      </motion.div>

                      {/* Current user indicator with pulse */}
                      {member.isCurrentUser && (
                        <motion.div
                          className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-xs px-3 py-1 rounded-full shadow-lg"
                          animate={{
                            scale: [1, 1.1, 1],
                            boxShadow: [
                              '0 0 0 0 rgba(0, 212, 170, 0.7)',
                              '0 0 0 10px rgba(0, 212, 170, 0)',
                              '0 0 0 0 rgba(0, 212, 170, 0)',
                            ],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: 'easeInOut',
                          }}
                        >
                          你
                        </motion.div>
                      )}
                    </div>
                  </Tooltip>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Enhanced loading indicator */}
          {isLoading && (
            <motion.div
              className="text-center mt-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="inline-flex items-center gap-3 text-gray-500 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
              >
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Number.POSITIVE_INFINITY,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">正在加载更多早鸟用户...</span>
              </motion.div>
            </motion.div>
          )}
        </motion.div>

        {/* Enhanced Share Section */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            delay: 2.5,
            duration: 1,
            type: 'spring' as const,
            stiffness: 100,
          }}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <PulsatingButton
              className="bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 hover:from-teal-600 hover:via-emerald-600 hover:to-green-600 text-white font-semibold px-10 py-4 rounded-2xl shadow-2xl transition-all duration-300 text-lg"
              pulseColor="0, 212, 170"
              onClick={() => setShareModalVisible(true)}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
                className="inline-block mr-3"
              >
                <ShareAltOutlined className="text-xl" />
              </motion.div>
              我的头像也在上面 🎉 去分享！
            </PulsatingButton>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Member Detail Modal */}
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
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(30px)',
            borderRadius: '24px',
            border: '1px solid rgba(0,212,170,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          },
        }}
        destroyOnClose
      >
        <AnimatePresence>
          {selectedMember && (
            <motion.div
              className="p-8"
              initial={{ opacity: 0, scale: 0.8, rotateY: 90 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotateY: -90 }}
              transition={{
                type: 'spring' as const,
                stiffness: 200,
                damping: 20,
                duration: 0.6,
              }}
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0, rotate: 180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring' as const, stiffness: 200 }}
                  whileHover={{ scale: 1.1, rotateY: 15 }}
                >
                  <Avatar
                    size={100}
                    src={selectedMember.avatar}
                    className={`${tierStyles[selectedMember.tier]} mx-auto mb-4 shadow-2xl`}
                  />
                </motion.div>
                <motion.h3
                  className="text-2xl font-bold text-gray-900 mb-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {selectedMember.name}
                </motion.h3>
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: 'spring' as const }}
                >
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${badgeStyles[selectedMember.badge]}`}
                  >
                    {getBadgeIcon(selectedMember.badge)}
                    <span>{selectedMember.badge.toUpperCase()}</span>
                  </div>
                </motion.div>
              </div>

              <motion.div
                className="space-y-4 text-gray-600"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1,
                      delayChildren: 0.5,
                    },
                  },
                }}
                initial="hidden"
                animate="visible"
              >
                {[
                  { label: '墙号', value: `#${selectedMember.wallNumber}` },
                  { label: '加入时间', value: selectedMember.joinDate },
                  { label: '贡献值', value: selectedMember.contributions },
                  { label: '等级', value: selectedMember.tier },
                ].map((item) => (
                  <motion.div
                    key={item.label}
                    className="flex justify-between py-2 px-4 bg-gradient-to-r from-teal-50/50 to-emerald-50/50 rounded-xl"
                    variants={{
                      hidden: { opacity: 0, x: -20 },
                      visible: { opacity: 1, x: 0 },
                    }}
                    whileHover={{
                      scale: 1.02,
                      backgroundColor: 'rgba(0, 212, 170, 0.1)',
                    }}
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="font-bold text-gray-900">{item.value}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>

      {/* Enhanced Share Modal */}
      <Modal
        title="分享你的早鸟身份"
        open={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        footer={null}
        width={550}
        className="share-modal"
        styles={{
          content: {
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(30px)',
            borderRadius: '24px',
            border: '1px solid rgba(0,212,170,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          },
        }}
      >
        <AnimatePresence>
          {shareModalVisible && (
            <motion.div
              className="space-y-8"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring' as const, stiffness: 200, damping: 20 }}
            >
              {/* Share Image Preview */}
              <motion.div
                ref={shareImageRef}
                className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-3xl p-10 text-center shadow-inner"
                style={{ width: '450px', height: '550px', margin: '0 auto' }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring' as const }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="mb-8">
                  <motion.div
                    initial={{ scale: 0, rotate: 180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.4, type: 'spring' as const, stiffness: 200 }}
                  >
                    <Avatar
                      size={120}
                      src={currentUser.avatar}
                      className="mx-auto mb-6 ring-6 ring-teal-400 ring-offset-6 shadow-2xl"
                    />
                  </motion.div>
                  <motion.h3
                    className="text-3xl font-bold text-gray-900 mb-3"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    {currentUser.name}
                  </motion.h3>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6, type: 'spring' as const }}
                  >
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${badgeStyles[currentUser.badge]}`}
                    >
                      {getBadgeIcon(currentUser.badge)}
                      <span>{currentUser.badge.toUpperCase()}</span>
                    </div>
                  </motion.div>
                </div>

                <motion.div
                  className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <div className="text-4xl font-bold text-teal-600 mb-2">
                    #{currentUser.wallNumber}
                  </div>
                  <div className="text-gray-600 font-medium">早鸟编号</div>
                </motion.div>

                <motion.div
                  className="text-gray-700 leading-relaxed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <p className="mb-3 font-medium">曾在黎明前按下启动键</p>
                  <p className="mb-3 font-medium">也在无声处埋下信念</p>
                  <p className="mb-6 font-medium">向每一位创造者致敬，未来一起继续飞</p>
                  <p className="font-bold text-teal-600 text-lg">👉 refly.ai</p>
                </motion.div>
              </motion.div>

              {/* Download Button */}
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                <ShimmerButton
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-xl"
                  onClick={generateShareImage}
                >
                  <motion.span
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
                    className="inline-block mr-2"
                  >
                    💾
                  </motion.span>
                  下载分享图片
                </ShimmerButton>
              </motion.div>

              {/* Social Share Options */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                <h4 className="text-xl font-bold text-gray-900 mb-6 text-center">分享到社交平台</h4>
                <motion.div
                  className="grid grid-cols-5 gap-4"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.1,
                        delayChildren: 1.1,
                      },
                    },
                  }}
                  initial="hidden"
                  animate="visible"
                >
                  {[
                    { name: '微信好友', key: 'wechat', color: 'bg-green-500', emoji: '💬' },
                    { name: '小红书', key: 'xiaohongshu', color: 'bg-red-500', emoji: '📱' },
                    { name: 'X', key: 'twitter', color: 'bg-black', emoji: '🐦' },
                    { name: 'Discord', key: 'discord', color: 'bg-indigo-500', emoji: '🎮' },
                    { name: 'Telegram', key: 'telegram', color: 'bg-blue-500', emoji: '✈️' },
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
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        className={`${platform.color} text-white border-none hover:opacity-80 transition-all rounded-2xl h-16 flex flex-col items-center justify-center font-medium`}
                        onClick={() => shareToSocial(platform.name)}
                      >
                        <motion.span
                          className="text-xl mb-1"
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{
                            duration: 3,
                            repeat: Number.POSITIVE_INFINITY,
                            delay: Math.random() * 2,
                          }}
                        >
                          {platform.emoji}
                        </motion.span>
                        <span className="text-xs">{platform.name}</span>
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
