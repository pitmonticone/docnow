import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Tweet from './Tweet'

import style from '../styles/Tweets.css'

export default class TweetList extends Component {

  componentDidMount() {
    console.log('search id: ' + this.props.id)
    this.tick()
    this.timerId = setInterval(() => {
      this.tick()
    }, 3000)
  }

  componentWillUnmount() {
    clearInterval(this.timerId)
  }

  tick() {
    if (this.props.id) {
      this.props.getTweets(this.props.id)
    }
  }

  render() {
    let loader = null
    if (this.props.tweets.length === 0) {
      loader = 'Loading...'
    }
    return (
        <div className={ style.TweetsCard }>
          {loader}
          {this.props.tweets.map(tweet => (
            <Tweet key={tweet.id} data={tweet}/>
          ))}
        </div>
    )
  }
}

TweetList.propTypes = {
  id: PropTypes.string,
  getTweets: PropTypes.func,
  tweets: PropTypes.array
}
