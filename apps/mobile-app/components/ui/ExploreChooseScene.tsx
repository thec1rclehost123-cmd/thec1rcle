import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SCENE_CATEGORIES = [
  {
    id: 'bollywood',
    label: 'BOLLYWOOD',
    bg: '#F44A22',
    image: require('../../../assets/bollywood.jpg'),
  },
  { id: 'techno', label: 'TECHNO', bg: '#8B5CF6', image: require('../../../assets/techno.jpg') },
  { id: 'raves', label: 'RAVES', bg: '#3B82F6', image: require('../../../assets/raves.jpg') },
  {
    id: 'pool-parties',
    label: 'POOL\nPARTIES',
    bg: '#06B6D4',
    image: require('../../../assets/pool.jpg'),
  },
  {
    id: 'sundowners',
    label: 'SUN\nDOWNERS',
    bg: '#EAB308',
    image: require('../../../assets/09f5dd049312a8bf3c50ea656e1a203b.jpg'),
  },
];

function SectionHeader({ title }: { title: string }) {
  const words = title.trim().split(' ');
  const lastWord = words.pop() || '';
  const firstPart = words.join(' ');

  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={styles.glowBar} />
        <Text style={styles.sectionTitle}>
          {firstPart}
          {firstPart ? ' ' : ''}
          <Text style={styles.sectionTitleAccent}>{lastWord}</Text>
        </Text>
      </View>
    </View>
  );
}

export function ExploreChooseScene() {
  const handlePress = (cat: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/events/feed', params: { type: cat.id } });
  };

  const renderCard = (cat: any, fontSize = 16) => (
    <Pressable
      onPress={() => handlePress(cat)}
      style={{ flex: 1, backgroundColor: cat.bg, borderRadius: 12, overflow: 'hidden' }}
    >
      <Image source={cat.image} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48 }}
      />
      <Text
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          color: '#FFF',
          fontSize,
          fontWeight: '900',
          letterSpacing: 0,
          lineHeight: fontSize * 1.1,
        }}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {cat.label}
      </Text>
    </Pressable>
  );

  const CONTAINER_SIZE = SCREEN_WIDTH;

  return (
    <View style={{ marginTop: 12, marginBottom: 44 }}>
      <SectionHeader title="Choose Your Scene" />
      <View style={{ paddingHorizontal: 0 }}>
        <View style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE, gap: 6 }}>
          {/* Top Row */}
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            <View style={{ flex: 2 }}>{renderCard(SCENE_CATEGORIES[0], 18)}</View>
            <View style={{ flex: 1 }}>{renderCard(SCENE_CATEGORIES[4], 18)}</View>
          </View>

          {/* Bottom Row */}
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            <View style={{ flex: 1 }}>{renderCard(SCENE_CATEGORIES[2], 18)}</View>
            <View style={{ flex: 1 }}>{renderCard(SCENE_CATEGORIES[3], 18)}</View>
            <View style={{ flex: 1 }}>{renderCard(SCENE_CATEGORIES[1], 18)}</View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  glowBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FDE047',
    letterSpacing: 0,
  },
  sectionTitleAccent: {
    color: '#8B5CF6',
    textShadowColor: 'rgba(244,74,34,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
