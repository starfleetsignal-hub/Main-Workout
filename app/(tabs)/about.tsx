import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>About MuscleGuide</Text>
        <Text style={styles.lead}>
          MuscleGuide is a reference for training and stretching every major muscle group safely and effectively.
        </Text>

        <Section title="Where the guidance comes from">
          <Text style={styles.body}>
            Every exercise, stretch, cue, and safety note in this app is written to reflect mainstream,
            widely-published exercise-science consensus — the kind of programming principles taught in
            strength & conditioning certifications (such as the NSCA and NASM), sports-medicine and
            physical-therapy training, and standard kinesiology and anatomy references used throughout
            university exercise-science programs.
          </Text>
          <Text style={styles.body}>
            This app is an independent educational reference. It is not affiliated with, reviewed by, or
            endorsed by any specific hospital, university, medical board, athlete, or coach, and no such
            claim should be inferred from its content.
          </Text>
        </Section>

        <Section title="Medical disclaimer">
          <Text style={styles.body}>
            MuscleGuide provides general fitness education, not medical advice, diagnosis, or personalized
            treatment. Talk to a physician before starting any new exercise program, especially if you are
            pregnant, recovering from injury or surgery, or managing a chronic health condition. Stop any
            exercise immediately if you feel sharp pain, dizziness, chest discomfort, or shortness of
            breath, and seek medical attention if symptoms persist.
          </Text>
        </Section>

        <Section title="How to use the app">
          <Text style={styles.body}>
            Browse by muscle group on the Muscles tab, or jump straight to a muscle with Search. Each
            muscle page has three tabs: Strength (progressive exercises from beginner to advanced),
            Stretch (mobility and flexibility work), and Anatomy (a plain-language explanation of what the
            muscle does). Tap the star on any muscle to save it to Favorites.
          </Text>
        </Section>

        <Section title="Version">
          <Text style={styles.body}>MuscleGuide 1.0.0</Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontFamily: fonts.extrabold,
    marginBottom: 8,
  },
  lead: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: 13,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  body: {
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 10,
  },
});
