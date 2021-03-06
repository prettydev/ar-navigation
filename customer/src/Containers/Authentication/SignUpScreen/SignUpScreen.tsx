import React, {useState, useEffect} from 'react';
import {Image, View, Text, TextInput, ScrollView, Platform} from 'react-native';
import {TouchableOpacity} from 'react-native-gesture-handler';

import FastImage from 'react-native-fast-image';

import Style from 'src/Style';
import Styles from './SignUpScreenStyle';
import Colors from 'src/Theme/Colors';

import CustomPwdInput from 'src/Components/CustomForm/CustomPwdInput/CustomPwdInput';
import CustomPhoneInput from 'src/Components/CustomForm/CustomPhoneInput/CustomPhoneInput';
import FormCommonBtn from 'src/Components/Buttons/FormCommonBtn/FormCommonBtn';

import {Images} from 'src/Theme';

import Toast from 'react-native-simple-toast';

import AsyncStorage from '@react-native-community/async-storage';

import {store} from 'src/Store';
import ImagePicker from 'react-native-image-picker';
import ImageResizer from 'react-native-image-resizer';
import axios from 'axios';

import {baseUrl, appVersion, avatarSize} from 'src/config';
import {RESULTS} from 'react-native-permissions';

import {checkCamLibPermission} from 'src/Permissions';
import EvilIconsIcon from 'react-native-vector-icons/EvilIcons';

import {useTranslation} from 'react-i18next';

export default function SignUpScreen(props) {
  const {t} = useTranslation();

  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [init, setInit] = useState(0);
  const [sentOtp, setSentOtp] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [photo, setPhoto] = useState('');
  const [localPhoto, setLocalPhoto] = useState('');

  const sendOTP = async () => {
    await axios
      .post(baseUrl + 'auth/otp', {
        phone,
      })
      .then(response => {
        if (response.data.success) {
          setSentOtp(true);
          Toast.show(response.data.msg); //check your inbox
          console.log('success', response.data.msg);
        } else {
          Toast.show(response.data.msg);
          setInit(init + 1);
          console.log('failed', response.data.msg);
        }
      })
      .catch(error => {
        console.log(error);
      });
  };

  const handlePhoto = async () => {
    if (Platform.OS === 'android') {
      const ret = await checkCamLibPermission();
      console.log('111111111111111', ret);
      if (!ret) return;
    }

    ImagePicker.showImagePicker(response => {
      if (response.didCancel) {
      } else if (response.error) {
      } else if (response.customButton) {
      } else {
        ImageResizer.createResizedImage(
          response.uri,
          avatarSize,
          avatarSize,
          'JPEG',
          100,
          0,
        )
          .then(({uri, path, name, size}) => {
            console.log('uri', uri, 'path', path, 'name', name, 'size', size);

            setLocalPhoto(uri);
            let formData = new FormData();
            const file = {
              uri,
              name,
              type: 'image/jpeg',
            };
            formData.append('file', file);

            changePhoto(formData);
          })
          .catch(err => {
            console.log('resize error... ... ...', err);
          });
      }
    });
  };

  async function changePhoto(formData) {
    await axios
      .post(baseUrl + 'upload/file', formData)
      .then(response => {
        console.log(response.data.file.path);
        setPhoto(response.data.file.path);
      })
      .catch(error => {
        console.log(error);
        Toast.show(t('error'));
      });
  }

  async function handleSubmit() {
    if (email === '' || phone === '' || photo === '' || password === '') {
      Toast.show(t('invalid'));
      return;
    }

    if (password !== confirmPassword) {
      Toast.show(t('same_pass'));
      return;
    }

    console.log(phone, password);

    setLoading(true);

    axios
      .post(baseUrl + 'auth/signup', {
        email,
        phone,
        photo,
        password,
        otp,
      })
      .then(function(response2) {
        if (response2.data.success) {
          Toast.show(response2.data.msg);

          props.navigation.navigate('SignIn');
        } else {
          setLoading(false);
          Toast.show(response2.data.msg);
        }
      })
      .catch(function(error) {
        setLoading(false);
        Toast.show(t('network_error'));
      });
  }

  return (
    <ScrollView>
      <View style={{flexDirection: 'column'}}>
        <TouchableOpacity
          onPress={handlePhoto}
          style={{
            marginRight: 15,
            // resizeMode: 'cover',
            borderRadius: 30,
          }}>
          <View style={{flex: 1, alignItems: 'center', marginTop: 25}}>
            {localPhoto.length === 0 && (
              <EvilIconsIcon name="user" style={{fontSize: 120}} />
            )}
            {localPhoto.length > 0 && (
              <FastImage
                style={{width: 120, height: 120, borderRadius: 60}}
                source={{uri: 'file://' + localPhoto}}
                resizeMode={FastImage.resizeMode.cover}
              />
            )}
          </View>
        </TouchableOpacity>

        <View style={Styles.SignFormContainer}>
          <TextInput
            style={Style.CustomTextInput}
            placeholder={t('email')}
            onChangeText={value => {
              setEmail(value);
            }}
          />
          <TextInput
            style={Style.CustomTextInput}
            placeholder={t('phone')}
            onChangeText={value => {
              setPhone(value);
            }}
          />

          <CustomPwdInput
            CustomPwdPlaceholder={t('password')}
            proc={value => {
              setPassword(value);
            }}
          />

          <CustomPwdInput
            CustomPwdPlaceholder={t('confirm_pass')}
            proc={value => {
              setConfirmPassword(value);
            }}
          />

          <FormCommonBtn CustomBtnTitle={t('create')} proc={handleSubmit} loading={loading}/>

          <View style={{flexDirection: 'row', justifyContent: 'center'}}>
            <Text>{t('already_have_acc')}</Text>
            <TouchableOpacity
              onPress={() => props.navigation.navigate('SignIn')}>
              <Text
                style={{
                  color: Colors.primary,
                  textDecorationLine: 'underline',
                }}>
                {t('signin')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
