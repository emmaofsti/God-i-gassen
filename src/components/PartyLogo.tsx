import { Image, StyleSheet, View } from 'react-native';

const logoImage = require('@/assets/images/logo.png');

type Props = {
  compact?: boolean;
};

export function PartyLogo({ compact = false }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Image
        source={logoImage}
        style={[styles.logo, compact && styles.logoCompact]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  wrapCompact: {
    alignItems: 'flex-start',
  },
  logo: {
    width: 240,
    height: 300,
  },
  logoCompact: {
    width: 100,
    height: 50,
  },
});
