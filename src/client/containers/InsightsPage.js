import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { getWebpages } from '../actions/webpages'
import { getSearch, resetTwitterSearch, updateSearch, getTweets,
         getUsers, getImages, getVideos, getActions, createArchive, getHashtags, 
         deleteSearch } from '../actions/search'

import Insights from '../components/Insights/Insights'

const mapStateToProps = (state, ownProps) => {
  return {
    searchId: ownProps.match.params.searchId,
    search: state.search,
    searches: state.searches,
    user: state.user,
    webpages: state.webpages,
    archived: state.search.archived,
    actions: state.search.actions,
  }
}

const actions = {
  getSearch,
  getTweets,
  getUsers,
  getImages,
  getVideos,
  getWebpages,
  getActions,
  resetTwitterSearch,
  updateSearch,
  deleteSearch,
  createArchive,
  getHashtags
}

const mapDispatchToProps = (dispatch) => bindActionCreators(actions, dispatch)

export default connect(mapStateToProps, mapDispatchToProps)(Insights)
