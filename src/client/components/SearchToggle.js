import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Modal from 'react-modal'
import TextField from '@material-ui/core/TextField'
import Button from '@material-ui/core/Button'
import Switch from '@material-ui/core/Switch'
import CloseModal from './Insights/CloseModal'
import DateFnsUtils from '@date-io/moment'
import { MuiPickersUtilsProvider, DatePicker } from '@material-ui/pickers'

import { ServerStyleSheets } from '@material-ui/styles'
import style from './SearchToggle.css'

export default class SearchToggle extends Component {

  constructor(props) {
    super(props)
    this.resetError = this.resetError.bind(this)

    const host = window.location.host
    const lastQuery = this.props.search.queries[this.props.search.queries.length - 1]
    const queryText = lastQuery.value.or.map(v => v.value).join(' ')
    const tweetText = this.props.instanceTweetText
      .replace('{query}', `"${queryText}"`)
      .replace('{collection-url}', `https://${host}/collection/${this.props.search.id}/`)

    this.state = {
      error: null,
      modalOpen: false,
      title: this.props.search.title,
      description: this.props.search.description,
      descriptionError: false,
      tweetText: tweetText,
      tweetTextError: false,
      limit: null,
      startDate: null
    }
  }

  resetError() {
    this.setState({error: null})
  }

  start() {

    let error = false
    if (! this.state.description && ! this.props.user.admin) {
      error = true
      this.setState({descriptionError: true})
    }

    if (! this.state.tweetText && ! this.props.user.admin) {
      error = true
      this.setState({tweetTextError: true})
    }

    if (error) {
      return
    }

    this.props.updateSearch({
      id: this.props.search.id,
      description: this.state.description,
      tweetText: this.state.tweetText,
      active: true,
      archived: false,
    })

    this.setState({
      modalOpen: false,
    })
  }

  stop() {
    this.props.updateSearch({
      id: this.props.search.id,
      active: false
    })
  }

  render() {
    const app = document.getElementById('App')
    const title = this.props.search.active ? 'Stop Data Collection' : 'Start Data Collection'
    const color = this.props.search.active ? 'primary' : 'secondary'

    const modalStyle = {
      content: {
        padding: 0,
        marginLeft: 'auto',
        marginRight: 'auto',
        width: 600,
      }
    }

    const adminNote = ' Since you are an adminstrator on this instance you can leave this blank.'

    return (
      <>

        <Switch className={ServerStyleSheets.Admin}
          checked={this.props.search.active}
          color={color}
          title={title}
          onChange={() => {
            if (this.props.search.active) {
              this.stop()
            } else {
              this.setState({
                descriptionError: false,
                tweetTextError: false,
                modalOpen: true
              })
            }
          }} />

        <Modal 
          onClose={() => this.setState({modalOpen: false})} 
          isOpen={this.state.modalOpen} 
          style={modalStyle} 
          appElement={app}>

          <CloseModal title="Activate Your Search" close={() => this.setState({modalOpen: false})} style={{width: 590}} />
          <div className={style.SearchToggle}>

            <section>
              Activating your search makes it available as a public <em>Collection</em> so 
              that users can consent to having their tweets archived. In order to do this 
              you will need to supply a description of your collection, and indicate how 
              you would like to announce it on Twitter. 
            </section>

            <section>
              <TextField 
                required={true}
                variant="outlined"
                id="title"
                name="title"
                lable="Collection Title"
                helperText="A short title for your collection."
                value={this.state.title} 
                onChange={e => this.setState({title: e.target.value})}
                fullWidth={true} />
            </section>

            <section>
              <TextField
                error={this.state.descriptionError}
                required={true}
                variant="outlined"
                id="description"
                name="description"
                label="Collection Description"
                multiline={true}
                rows={5}
                helperText={`A description of your search to help others understand why you are creating the collection.${adminNote}`}
                placeholder="For example: This collection is being created to document this significant event in our community. Data will be stored in our community center."
                value={this.state.description || ''} 
                onChange={e => this.setState({description: e.target.value})} />
            </section>

            <section>
              <TextField
                error={this.state.tweetTextError}
                required={this.props.user.admin}
                variant="outlined"
                id="tweet"
                name="tweet"
                label="Tweet Text"
                multiline={true}
                rows={5}
                helperText={`Starting tweet collection will cause a tweet to be sent on your behalf letting users know about your collection.${adminNote}`}
                value={this.state.tweetText} 
                onChange={e => this.setState({tweetText: e.target.value})} />
            </section>

            <section>
              <TextField
                error={this.state.limitError}
                required={false}
                variant="outlined"
                id="limit"
                name="limit"
                label="Tweet Limit"
                type="number"
                helperText={`Limit the total number of tweets collected. If the box is left blank your search will accumulate tweets until your quota is met.`}
                value={this.state.limit}
                onChange={e => {
                  const limit = parseInt(e.target.value, 10)
                  if (e.target.value === '' || limit >= 0) {
                    this.setState({limit: limit})
                  } else {
                    this.setState({limitError: true})
                  }
                }} />
            </section>

            <section>
              <MuiPickersUtilsProvider 
                utils={DateFnsUtils}>
                <DatePicker
                  label="Historical Tweets"
                  value={this.state.startDate}
                  disableFuture={true}
                  inputVariant="outlined"
                  minDate={new Date(2006, 2, 21)}
                  autoOk={true}
                  labelFunc={d => {
                    return d ? d.format('LL') : ''
                  }}
                  helperText="Collect historical tweets back to this date. Your DocNow instance will need to have Academic Research API keys to search more than a week into the past. If left blank only new tweets will be collected."
                  onChange={d => this.setState({startDate: d})} />
              </MuiPickersUtilsProvider>
            </section>

            <section>
              <Button 
                onClick={() => this.start()}
                variant="contained" 
                color="primary">Start</Button>
            </section>

          </div>

        </Modal>
      </>
    )
  }

}

SearchToggle.propTypes = {
  search: PropTypes.object,
  user: PropTypes.object,
  updateSearch: PropTypes.func,
  instanceTweetText: PropTypes.string,
}
