import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  Switch,
  Alert,
  Platform,
  Share
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const App = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyData, setDailyData] = useState({});
  const [weightData, setWeightData] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempWeight, setTempWeight] = useState('');
  const [graphMode, setGraphMode] = useState('progress');

  const today = new Date().toISOString().split('T')[0];

  // Theme
  const theme = darkMode ? {
    bg: '#1a1a1a',
    cardBg: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    border: '#404040',
    accent: '#f0db4f',
    orange: '#ff6b35',
    blue: '#4169e1',
    green: '#4caf50'
  } : {
    bg: '#f8f9fa',
    cardBg: '#ffffff',
    text: '#2c3e50',
    textSecondary: '#7f8c8d',
    border: '#e1e8ed',
    accent: '#f39c12',
    orange: '#ff6b35',
    blue: '#4169e1',
    green: '#4caf50'
  };

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Save data
  useEffect(() => {
    saveData();
  }, [dailyData, weightData, startDate, darkMode]);

  useEffect(() => {
    if (showWeightModal) {
      const selectedWeight = weightData[selectedDate];
      if (selectedWeight) {
        setTempWeight(selectedWeight.toString());
      } else {
        const sortedDates = Object.keys(weightData).sort().reverse();
        if (sortedDates.length > 0) {
          setTempWeight(weightData[sortedDates[0]].toString());
        } else {
          setTempWeight('70');
        }
      }
    }
  }, [showWeightModal, weightData, selectedDate]);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('onePunchManData');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setDailyData(parsed.dailyData || {});
        setWeightData(parsed.weightData || {});
        setStartDate(parsed.startDate || new Date().toISOString().split('T')[0]);
        setDarkMode(parsed.darkMode || false);
      }
    } catch (error) {
      console.log('Error loading data:', error);
    }
  };

  const saveData = async () => {
    try {
      const dataToSave = {
        dailyData,
        weightData,
        startDate,
        darkMode
      };
      await AsyncStorage.setItem('onePunchManData', JSON.stringify(dataToSave));
    } catch (error) {
      console.log('Error saving data:', error);
    }
  };

  const calculateStats = () => {
    let totalPoints = 0;
    let currentStreak = 0;
    let lastDate = null;

    const sortedDates = Object.keys(dailyData).sort();

    sortedDates.forEach(date => {
      const dayData = dailyData[date];
      const dayPoints = (dayData.pushups ? 10 : 0) +
      (dayData.situps ? 10 : 0) +
      (dayData.squats ? 10 : 0) +
      (dayData.running ? 10 : 0);
      totalPoints += dayPoints;

      if (dayPoints === 40) {
        if (!lastDate || isConsecutive(lastDate, date)) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
        lastDate = date;
      } else if (dayPoints > 0) {
        currentStreak = 0;
      }
    });

    return { totalPoints, streak: currentStreak };
  };

  const isConsecutive = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
  };

  const getHeroRank = (points) => {
    if (points >= 14600) return { rank: 'S', color: '#FFD700' };
    if (points >= 10000) return { rank: 'A', color: '#FF6B35' };
    if (points >= 5000) return { rank: 'B', color: '#4169E1' };
    return { rank: 'C', color: '#808080' };
  };

  const handleCheckbox = (exercise) => {
    const newData = { ...dailyData };
    if (!newData[selectedDate]) {
      newData[selectedDate] = {};
    }
    newData[selectedDate][exercise] = !newData[selectedDate][exercise];
    setDailyData(newData);
  };

  const adjustWeight = (amount) => {
    const current = parseFloat(tempWeight) || 0;
    const newWeight = Math.max(0, current + amount);
    setTempWeight(newWeight.toFixed(1));
  };

  const saveWeight = () => {
    const weight = parseFloat(tempWeight);
    if (!isNaN(weight) && weight > 0) {
      setWeightData({
        ...weightData,
        [selectedDate]: weight
      });
      setShowWeightModal(false);
    }
  };

  const changeDate = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    const newDate = current.toISOString().split('T')[0];

    if (newDate <= today) {
      setSelectedDate(newDate);
    }
  };

  const exportData = async () => {
    try {
      const dataStr = JSON.stringify({ dailyData, weightData, startDate }, null, 2);
      const fileName = `onepunchman_data_${new Date().toISOString().split('T')[0]}.json`;

      // Проверяем платформу
      if (Platform.OS === 'web') {
        // Веб-версия: используем blob и download
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Успех', 'Файл загружен!');
      } else {
        // Мобильная версия: используем FileSystem и Sharing
        const fileUri = FileSystem.cacheDirectory + fileName;

        await FileSystem.writeAsStringAsync(fileUri, dataStr);
        console.log('Файл создан:', fileUri);

        const isAvailable = await Sharing.isAvailableAsync();
        console.log('Sharing доступен:', isAvailable);

        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Сохранить данные тренировок',
            UTI: 'public.json'
          });
          Alert.alert('Успех', 'Выберите, куда сохранить файл');
        } else {
          const shareResult = await Share.share({
            message: dataStr,
            title: 'Данные тренировок One Punch Man'
          });

          if (shareResult.action === Share.sharedAction) {
            Alert.alert('Успех', 'Данные отправлены!');
          }
        }
      }
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      Alert.alert('Ошибка', `Не удалось экспортировать данные: ${error.message}`);
    }
  };

  const importData = async () => {
    try {
      if (Platform.OS === 'web') {
        // Веб-версия: используем input[type=file]
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';

        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              try {
                const imported = JSON.parse(event.target.result);
                setDailyData(imported.dailyData || {});
                setWeightData(imported.weightData || {});
                setStartDate(imported.startDate || new Date().toISOString().split('T')[0]);
                Alert.alert('Успех', 'Данные успешно импортированы!');
              } catch (error) {
                Alert.alert('Ошибка', 'Неверный формат файла');
              }
            };
            reader.readAsText(file);
          }
        };

        input.click();
      } else {
        // Мобильная версия: используем DocumentPicker
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true
        });

        if (result.canceled === false && result.assets && result.assets[0]) {
          const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
          const imported = JSON.parse(fileContent);
          setDailyData(imported.dailyData || {});
          setWeightData(imported.weightData || {});
          setStartDate(imported.startDate || new Date().toISOString().split('T')[0]);
          Alert.alert('Успех', 'Данные успешно импортированы!');
        }
      }
    } catch (error) {
      console.error('Ошибка импорта:', error);
      Alert.alert('Ошибка', `Не удалось импортировать данные: ${error.message}`);
    }
  };

  const formatDateRu = (dateStr) => {
    const date = new Date(dateStr);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('ru', options);
  };

  const { totalPoints, streak } = calculateStats();
  const { rank, color: rankColor } = getHeroRank(totalPoints);
  const selectedDayData = dailyData[selectedDate] || {};

  const getGraphData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = dailyData[dateStr] || {};
      const points = (dayData.pushups ? 10 : 0) +
      (dayData.situps ? 10 : 0) +
      (dayData.squats ? 10 : 0) +
      (dayData.running ? 10 : 0);
      const weight = weightData[dateStr] || null;

      data.push({
        date: date.getDate(),
                dateStr,
                points,
                weight,
                isSelected: dateStr === selectedDate
      });
    }
    return data;
  };

  const graphData = getGraphData();
  const maxGraphValue = graphMode === 'progress'
  ? 40
  : Math.max(...Object.values(weightData).filter(Boolean), 100);
  const minWeightValue = Math.min(...Object.values(weightData).filter(Boolean), 0);

  const exercises = [
    { key: 'pushups', icon: 'fitness', label: '100 отжиманий', color: theme.orange },
    { key: 'situps', icon: 'accessibility', label: '100 приседаний', color: theme.blue },
    { key: 'squats', icon: 'body', label: '100 пресс', color: theme.green },
    { key: 'running', icon: 'walk', label: '10 км бег', color: theme.accent }
  ];

  const dayPoints = (selectedDayData.pushups ? 10 : 0) +
  (selectedDayData.situps ? 10 : 0) +
  (selectedDayData.squats ? 10 : 0) +
  (selectedDayData.running ? 10 : 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
    <ScrollView style={styles.scrollView}>
    {/* Header */}
    <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
    <Text style={[styles.title, { color: theme.text }]}>
    💪 One Punch Man Training
    </Text>
    <TouchableOpacity onPress={() => setDarkMode(!darkMode)}>
    <Ionicons
    name={darkMode ? "sunny" : "moon"}
    size={24}
    color={theme.text}
    />
    </TouchableOpacity>
    </View>

    {/* Stats Cards */}
    <View style={styles.statsContainer}>
    <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
    <Ionicons name="trophy" size={24} color={theme.accent} />
    <Text style={[styles.statValue, { color: theme.text }]}>{totalPoints}</Text>
    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Очки</Text>
    </View>

    <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
    <Text style={[styles.rankBadge, { color: rankColor, borderColor: rankColor }]}>
    {rank}
    </Text>
    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Ранг героя</Text>
    </View>

    <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
    <Ionicons name="flame" size={24} color={theme.orange} />
    <Text style={[styles.statValue, { color: theme.text }]}>{streak}</Text>
    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Дней подряд</Text>
    </View>
    </View>

    {/* Date Navigator */}
    <View style={[styles.dateNavigator, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
    <TouchableOpacity onPress={() => changeDate(-1)}>
    <Ionicons name="chevron-back" size={28} color={theme.accent} />
    </TouchableOpacity>

    <View style={styles.dateInfo}>
    <Text style={[styles.dateText, { color: theme.text }]}>
    {formatDateRu(selectedDate)}
    </Text>
    <Text style={[styles.pointsText, { color: theme.accent }]}>
    {dayPoints} / 40 очков
    </Text>
    </View>

    <TouchableOpacity
    onPress={() => changeDate(1)}
    disabled={selectedDate === today}
    style={{ opacity: selectedDate === today ? 0.3 : 1 }}
    >
    <Ionicons name="chevron-forward" size={28} color={theme.accent} />
    </TouchableOpacity>
    </View>

    {/* Exercises */}
    <View style={[styles.exercisesCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
    {exercises.map((exercise) => (
      <TouchableOpacity
      key={exercise.key}
      style={[
        styles.exerciseRow,
        {
          backgroundColor: selectedDayData[exercise.key] ? `${exercise.color}22` : 'transparent',
          borderColor: selectedDayData[exercise.key] ? exercise.color : theme.border
        }
      ]}
      onPress={() => handleCheckbox(exercise.key)}
      >
      <View style={styles.exerciseLeft}>
      <Ionicons name={exercise.icon} size={24} color={exercise.color} />
      <Text style={[styles.exerciseLabel, { color: theme.text }]}>
      {exercise.label}
      </Text>
      </View>
      <Ionicons
      name={selectedDayData[exercise.key] ? "checkmark-circle" : "ellipse-outline"}
      size={28}
      color={selectedDayData[exercise.key] ? exercise.color : theme.textSecondary}
      />
      </TouchableOpacity>
    ))}
    </View>

    {/* Weight Button */}
    <TouchableOpacity
    style={[styles.weightButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
    onPress={() => setShowWeightModal(true)}
    >
    <Ionicons name="fitness" size={24} color={theme.accent} />
    <Text style={[styles.weightButtonText, { color: theme.text }]}>
    {weightData[selectedDate]
      ? `Вес: ${weightData[selectedDate]} кг`
      : 'Добавить вес'
    }
    </Text>
    </TouchableOpacity>

    {/* Graph Toggle */}
    <View style={[styles.graphToggle, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
    <TouchableOpacity
    style={[
      styles.toggleButton,
      graphMode === 'progress' && { backgroundColor: theme.accent }
    ]}
    onPress={() => setGraphMode('progress')}
    >
    <Text style={[
      styles.toggleText,
      { color: graphMode === 'progress' ? '#000' : theme.text }
    ]}>
    Прогресс
    </Text>
    </TouchableOpacity>

    <TouchableOpacity
    style={[
      styles.toggleButton,
      graphMode === 'weight' && { backgroundColor: theme.accent }
    ]}
    onPress={() => setGraphMode('weight')}
    >
    <Text style={[
      styles.toggleText,
      { color: graphMode === 'weight' ? '#000' : theme.text }
    ]}>
    Вес
    </Text>
    </TouchableOpacity>
    </View>

    {/* Graph */}
    <View style={[styles.graphCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
    <Text style={[styles.graphTitle, { color: theme.text }]}>
    <Ionicons name="bar-chart" size={20} color={theme.accent} />
    {' '}Последние 30 дней
    </Text>

    <View style={styles.graphContainer}>
    {graphData.map((day, index) => {
      const value = graphMode === 'progress' ? day.points : day.weight;
      const maxValue = graphMode === 'progress' ? 40 : maxGraphValue;
      const minValue = graphMode === 'progress' ? 0 : minWeightValue;
      const height = value !== null
      ? ((value - minValue) / (maxValue - minValue)) * 150
      : 0;

      return (
        <TouchableOpacity
        key={index}
        style={styles.graphBar}
        onPress={() => setSelectedDate(day.dateStr)}
        >
        <View
        style={[
          styles.bar,
          {
            height: Math.max(height, value !== null ? 10 : 2),
              backgroundColor: day.isSelected ? theme.accent :
              graphMode === 'progress'
      ? (day.points === 40 ? theme.orange : day.points > 0 ? theme.blue : theme.border)
      : (value !== null ? theme.accent : theme.border),
              opacity: day.isSelected ? 1 : 0.8
          }
        ]}
        />
        {index % 5 === 0 && (
          <Text style={[
            styles.graphLabel,
            { color: day.isSelected ? theme.accent : theme.textSecondary }
          ]}>
          {day.date}
          </Text>
        )}
        </TouchableOpacity>
      );
    })}
    </View>
    </View>

    {/* Export/Import */}
    <View style={styles.actionButtons}>
    <TouchableOpacity
    style={[styles.actionButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
    onPress={exportData}
    >
    <Ionicons name="download" size={20} color={theme.text} />
    <Text style={[styles.actionButtonText, { color: theme.text }]}>Экспорт</Text>
    </TouchableOpacity>

    <TouchableOpacity
    style={[styles.actionButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
    onPress={importData}
    >
    <Ionicons name="cloud-upload" size={20} color={theme.text} />
    <Text style={[styles.actionButtonText, { color: theme.text }]}>Импорт</Text>
    </TouchableOpacity>
    </View>

    <View style={{ height: 40 }} />
    </ScrollView>

    {/* Weight Modal */}
    <Modal
    visible={showWeightModal}
    transparent
    animationType="fade"
    onRequestClose={() => setShowWeightModal(false)}
    >
    <View style={styles.modalOverlay}>
    <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
    <Text style={[styles.modalTitle, { color: theme.text }]}>
    Вес на {formatDateRu(selectedDate)}
    </Text>

    <View style={styles.weightControls}>
    <TouchableOpacity
    style={[styles.weightButton, { backgroundColor: theme.accent }]}
    onPress={() => adjustWeight(-0.5)}
    >
    <Ionicons name="remove" size={24} color="#000" />
    </TouchableOpacity>

    <TextInput
    style={[styles.weightInput, { color: theme.text, borderColor: theme.border }]}
    value={tempWeight}
    onChangeText={setTempWeight}
    keyboardType="numeric"
    />

    <TouchableOpacity
    style={[styles.weightButton, { backgroundColor: theme.accent }]}
    onPress={() => adjustWeight(0.5)}
    >
    <Ionicons name="add" size={24} color="#000" />
    </TouchableOpacity>
    </View>

    <View style={styles.modalButtons}>
    <TouchableOpacity
    style={[styles.modalButton, { backgroundColor: theme.border }]}
    onPress={() => setShowWeightModal(false)}
    >
    <Text style={[styles.modalButtonText, { color: theme.text }]}>Отмена</Text>
    </TouchableOpacity>

    <TouchableOpacity
    style={[styles.modalButton, { backgroundColor: theme.accent }]}
    onPress={saveWeight}
    >
    <Text style={[styles.modalButtonText, { color: '#000' }]}>Сохранить</Text>
    </TouchableOpacity>
    </View>
    </View>
    </View>
    </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomWidth: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 15,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  rankBadge: {
    fontSize: 32,
    fontWeight: 'bold',
    borderWidth: 3,
    borderRadius: 50,
    width: 50,
    height: 50,
    textAlign: 'center',
    lineHeight: 44,
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    marginHorizontal: 15,
    borderRadius: 15,
    borderWidth: 2,
  },
  dateInfo: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  pointsText: {
    fontSize: 14,
    marginTop: 5,
  },
  exercisesCard: {
    margin: 15,
    padding: 15,
    borderRadius: 15,
    borderWidth: 2,
    gap: 10,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
  },
  exerciseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exerciseLabel: {
    fontSize: 16,
  },
  weightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 15,
    marginHorizontal: 15,
    borderRadius: 15,
    borderWidth: 2,
  },
  weightButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  graphToggle: {
    flexDirection: 'row',
    margin: 15,
    padding: 5,
    borderRadius: 15,
    borderWidth: 2,
  },
  toggleButton: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  graphCard: {
    margin: 15,
    padding: 15,
    borderRadius: 15,
    borderWidth: 2,
  },
  graphTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  graphContainer: {
    flexDirection: 'row',
    height: 180,
    alignItems: 'flex-end',
    gap: 2,
  },
  graphBar: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  graphLabel: {
    fontSize: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 15,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 15,
    borderRadius: 15,
    borderWidth: 2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
                                 justifyContent: 'center',
                                 alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    padding: 25,
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  weightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
    marginBottom: 20,
  },
  weightInput: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    borderWidth: 2,
    borderRadius: 10,
    padding: 10,
    minWidth: 100,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
